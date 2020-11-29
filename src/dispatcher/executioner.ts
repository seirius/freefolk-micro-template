import { Logger } from "@nestjs/common";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { DispatcherConfig } from "src/config/DispatcherConfig";
import * as pidusage from "pidusage";
import e = require("express");

const WINE_COMMAND = "wine";

export interface ProcessStats {
    cpu: number;
    memory: number;
    ctime: number;
    elapsed: number;
    timestamp: number;
    pid: number;
    ppid: number;
}

export interface BatchProcess {
    process: ChildProcessWithoutNullStreams;
    exited?: boolean;
    logger: Logger;
    stats?: ProcessStats;
    killed?: boolean;
}

export interface BatchStatsEvent {
    (batchProcess: BatchProcess): void;
}

export interface BatchStatsErrorEvent {
    (error: Error, batchProcess: BatchProcess): void;
}

export interface BatchErrorEvent {
    (error: Error, batchProcess: BatchProcess): void;
}

export interface BatchEndEvent {
    (batchProcess: BatchProcess): void;
}

export interface BatchStartEvent {
    (batchProcess: BatchProcess): void;
}

export class Executioner {
    private readonly logger = new Logger(Executioner.name);
    private children: BatchProcess[] = [];
    private statsEvent: BatchStatsEvent;
    private statsErrorEvent: BatchStatsErrorEvent;
    private batchErrorEvent: BatchErrorEvent;
    private batchEndEvent: BatchEndEvent;
    private batchStartEvent: BatchStartEvent;

    private listenToProcessStats(batchProcess: BatchProcess): void {
        if (DispatcherConfig.TRACK_STATS && !batchProcess.exited) {
            pidusage(batchProcess.process.pid, (error: Error, stats: ProcessStats) => {
                if (error) {
                    this.callStatErrorEvent(error, batchProcess);
                } else {
                    batchProcess.stats = stats;
                    this.callStatEvent(batchProcess);
                    setTimeout(
                        () => this.listenToProcessStats(batchProcess),
                        DispatcherConfig.TRACK_STATS_INVERVAL
                    );
                }
            });
        }
    }

    private addNewProcess(process: ChildProcessWithoutNullStreams): void {
        const batchProcess: BatchProcess = {
            process,
            logger: new Logger(`Process ${process.pid}`)
        };
        process.on("exit", (code, signal) => {
            batchProcess.exited = true;
            this.removeChild(batchProcess);
            this.callBatchEndEvent(batchProcess);
        });
        process.on("error", (error: Error) => {
            batchProcess.exited = true;
            this.removeChild(batchProcess);
            this.callBatchErrorEvent(error, batchProcess);
        });
        this.children.push(batchProcess);
        this.listenToProcessStats(batchProcess);
        this.callBatchStartEvent(batchProcess);
    }

    private removeChild(batchProcess: BatchProcess): void {
        const index = this.children
            .findIndex(bp => bp.process.pid === batchProcess.process.pid);
        this.children.splice(index, 1);
    }

    private callStatEvent(batchProcess: BatchProcess): void {
        if (this.statsEvent) {
            this.statsEvent(batchProcess);
        }
    }

    private callStatErrorEvent(error: Error, batchProcess: BatchProcess): void {
        batchProcess.logger.error(`Had an error obtaining stats: ${error.toString()}`);
        if (this.statsErrorEvent) {
            this.statsErrorEvent(error, batchProcess);
        }
    }

    private callBatchErrorEvent(error: Error, batchProcess: BatchProcess): void {
        batchProcess.logger.error(`Had an error: ${error.toString()}`);
        if (this.batchErrorEvent) {
            this.batchErrorEvent(error, batchProcess);
        }
    }

    private callBatchEndEvent(batchProcess: BatchProcess): void {
        batchProcess.logger.log(`Terminated.`);
        if (this.batchEndEvent) {
            this.batchEndEvent(batchProcess);
        }
    }

    private callBatchStartEvent(batchProcess: BatchProcess): void {
        batchProcess.logger.log(`Started.`);
        if (this.batchStartEvent) {
            this.batchStartEvent(batchProcess);
        }
    }

    public addStatEventListener(statEvent: BatchStatsEvent): Executioner {
        this.statsEvent = statEvent;
        return this;
    }

    public addStatErrorEvent(statErrorEvent: BatchStatsErrorEvent): Executioner {
        this.statsErrorEvent = statErrorEvent;
        return this;
    }

    public addBatchErrorEvent(batchErrorEvent: BatchErrorEvent): Executioner {
        this.batchErrorEvent = batchErrorEvent;
        return this;
    }

    public addBatchEndEvent(batchEndEvent: BatchEndEvent): Executioner {
        this.batchEndEvent = batchEndEvent;
        return this;
    }

    public addBatchStartEvent(batchStartEvent: BatchStartEvent): Executioner {
        this.batchStartEvent = batchStartEvent;
        return this;
    }

    public getStats(pid: number): Promise<any> {
        return pidusage(pid);
    }

    public giveBirth(): ChildProcessWithoutNullStreams {
        const process = spawn(WINE_COMMAND, [DispatcherConfig.BATCH_EXE_PATH]);
        this.addNewProcess(process);
        return process;
    }

    public kill(pid: number): Promise<void> {
        return new Promise((resolve) => {
            const batchProcess = this.children.find(({ process: { pid: fpid } }) => fpid == pid);
            if (batchProcess && !batchProcess.exited) {
                batchProcess.killed = true;
                batchProcess.process.kill();
                batchProcess.process.on("exit", () => resolve());
            } else {
                resolve();
            }
        });
    }

    public async killAll(): Promise<void> {
        await Promise.all(this.children.map(({ process: { pid } }) => this.kill(pid)));
        this.logger.log("All processes terminated");
    }

}
