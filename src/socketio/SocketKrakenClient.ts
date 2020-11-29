import { Logger } from "@nestjs/common";
import { connect } from "socket.io-client";
import { DatabaseConfig } from "src/config/DatabaseConfig";
import { DispatcherConfig } from "src/config/DispatcherConfig";

export interface KrakenInfoPayload {
    agentId: string;
    databaseConnection: {
        url: string;
        port: number;
        username: string;
        password: string;
        schema: string;
        type: string;
        instance: string;
    }
}

export interface OnInfoCallback {
    (info: KrakenInfoPayload): void;
}

export class SocketKrakenClient {
    private readonly logger = new Logger(SocketKrakenClient.name);
    private socket: SocketIOClient.Socket;
    private connectionErrorEmitted = false;

    private onInfoCbs: OnInfoCallback[] = [];

    constructor(
        private url: string,
        private agentType: string
    ) {
        this.socket = connect(this.url, {
            query: {
                "agent-type": this.agentType,
                "agent-id": DispatcherConfig.AGENT_ID
            }
        });
        this.socket.on("message", (info: KrakenInfoPayload) => this.executeOnInfoCbs(info));
        this.socket.on("connect", () => {
            if (this.connectionErrorEmitted) {
                this.connectionErrorEmitted = false;
                this.logger.log("Reconnected to Kraken");
            } else {
                this.logger.log("Connected to Kraken");
            }
        });
        this.socket.on("disconnect", () => this.logger.log("Disconnected from Kraken"));
        this.socket.on("error", (error: any) => this.logger.error(error));
        this.socket.on("connect_error", (error: any) => {
            if (!this.connectionErrorEmitted) {
                this.connectionErrorEmitted = true;
                this.logger.error(error);
            }
        });
    }

    public onInfo(callback: OnInfoCallback): void {
        this.onInfoCbs.push(callback);
    }

    public executeOnInfoCbs(info: KrakenInfoPayload): void {
        this.loadKrakenInfo(info);
        this.logger.log("New Kraken's info loaded");
        this.onInfoCbs.forEach(cb => cb(info));
    }

    public sendEvent(channel: string, payload: any): void {
        this.socket.emit(channel, JSON.stringify(payload));
    }

    private loadKrakenInfo(info: KrakenInfoPayload): void {
        DispatcherConfig.AGENT_ID = info.agentId;
        DatabaseConfig.TYPE = info.databaseConnection?.type;
        DatabaseConfig.HOST = info.databaseConnection?.url;
        DatabaseConfig.PORT = info.databaseConnection?.port;
        DatabaseConfig.USERNAME = info.databaseConnection?.username;
        DatabaseConfig.PASSWORD = info.databaseConnection?.password;
        DatabaseConfig.SCHEMA = info.databaseConnection?.schema;
        DatabaseConfig.INSTANCE = info.databaseConnection?.instance;
    }

    public close(): void {
        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.socket.close();
        this.logger.log("Socket closed");
    }
}
