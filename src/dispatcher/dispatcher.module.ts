import { Module } from "@nestjs/common";
import { DispatcherController } from "./dispatcher.controller";

@Module({
    controllers: [DispatcherController]
})
export class DispatcherModule { }
