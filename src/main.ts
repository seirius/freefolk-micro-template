import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ServerConfig } from "./config/ServerConfig";
import { INestApplication, Logger } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { LoggerConfig } from "./config/LoggerConfig";
import { SocketKrakenClient } from "./socketio/SocketKrakenClient";
import { DispatcherConfig } from "./config/DispatcherConfig";
import { BatchProcess, Executioner } from "./dispatcher/executioner";

export interface BatchMessage {
    agentType: string;
    agentId: string;
    payload: any;
}

enum BatchMessageType {
    STATS = "stats",
    STATS_ERROR = "stats_error",
    BATCH_ERROR = "batch_error",
    BATCH_END = "batch_end",
    BATCH_START = "batch_start"
}

export class Dispatcher {
    private static readonly EXIT_SIGNALS = ["SIGINT", "SIGTERM", "SIGQUIT"];
    private readonly logger = new Logger(Dispatcher.name);
    public executioner: Executioner;
    private nestServer: NestServer;
    private socketClient: SocketKrakenClient;
    private closedAll = false;

    public async init(): Promise<void> {
        this.nestServer = new NestServer();
        this.executioner = new Executioner();
        if (!DispatcherConfig.UNATTACHED) {
            this.socketClient = new SocketKrakenClient(DispatcherConfig.KRAKEN_SOCKET_URL, DispatcherConfig.TYPE);
            this.socketClient.onInfo(() => this.nestServer.init());
            this.executioner
                .addStatEventListener(batchProcess => this.socketClient
                    .sendEvent(DispatcherConfig.KRAKEN_SOCKET_CHANNEL, Dispatcher.createBatchMessage(BatchMessageType.STATS, batchProcess)));
            this.executioner
                .addStatErrorEvent((error, batchProcess) => this.socketClient
                    .sendEvent(DispatcherConfig.KRAKEN_SOCKET_CHANNEL, Dispatcher.createBatchMessage(BatchMessageType.STATS_ERROR, batchProcess, error)));
            this.executioner
                .addBatchErrorEvent((error, batchProcess) => this.socketClient
                    .sendEvent(DispatcherConfig.KRAKEN_SOCKET_CHANNEL, Dispatcher.createBatchMessage(BatchMessageType.BATCH_ERROR, batchProcess, error)));
            this.executioner
                .addBatchEndEvent(batchProcess => this.socketClient
                    .sendEvent(DispatcherConfig.KRAKEN_SOCKET_CHANNEL, Dispatcher.createBatchMessage(BatchMessageType.BATCH_END, batchProcess)));
            this.executioner
                .addBatchStartEvent(batchProcess => this.socketClient
                    .sendEvent(DispatcherConfig.KRAKEN_SOCKET_CHANNEL, Dispatcher.createBatchMessage(BatchMessageType.BATCH_START, batchProcess)));
        } else {
            this.logger.log("Loading in unattached mode");
            await this.nestServer.init();
        }
        Dispatcher.EXIT_SIGNALS.forEach((signal: any) => process.on(signal, () => this.closeAll()));
    }

    public async closeAll(): Promise<void> {
        if (!this.closedAll) {
            this.closedAll = true;
            this.nestServer.close();
            if (this.socketClient) {
                this.socketClient.close();
            }
            await this.executioner.killAll();
            process.exit();
        }
    }

    private static createBatchMessage(messageType: BatchMessageType, batchProcess: BatchProcess, error?: Error): BatchMessage {
        const batchProcessCopy: any = { ...batchProcess };
        delete batchProcessCopy.logger;
        delete batchProcessCopy.process;
        batchProcessCopy.pid = batchProcess.process.pid;
        return {
            agentType: DispatcherConfig.TYPE,
            agentId: DispatcherConfig.AGENT_ID,
            payload: {
                messageType,
                batchProcess: batchProcessCopy,
                error
            }
        };
    }
}

export class NestServer {
    private readonly logger = new Logger(NestServer.name);
    private app: INestApplication;

    constructor() { }

    public async init(): Promise<void> {
        if (DispatcherConfig.ENABLE_API && !this.app) {
            this.app = await NestFactory.create(AppModule, {
                logger: LoggerConfig.LEVEL as any,
            });

            const options = new DocumentBuilder()
                .setTitle("Batch dispatcher")
                .setDescription("Batch Dispatcher")
                .setVersion("1.0")
                .addTag("dispatcher")
                .build();

            const document = SwaggerModule.createDocument(this.app, options);
            SwaggerModule.setup("api", this.app, document);

            await this.app.listen(ServerConfig.PORT);
            this.logger.log(`Server running on http://localhost:${ServerConfig.PORT}`);
        }
    }

    public close(): void {
        if (this.app) {
            this.app.close();
            this.logger.log("Server closed");
        }
    }
}

export const DISPATCHER = new Dispatcher();
DISPATCHER.init();
