import { Controller, Get, Param } from "@nestjs/common";
import { DISPATCHER } from "src/main";

@Controller("/dispatcher")
export class DispatcherController {

    @Get("run")
    public run(): number {
        return DISPATCHER.executioner.giveBirth().pid;
    }

    @Get("stats/:pid")
    public getStats(@Param("pid") pid: number): Promise<any> {
        return DISPATCHER.executioner.getStats(pid);
    }

    @Get("kill/:pid")
    public kill(@Param("pid") pid: number): any {
        return DISPATCHER.executioner.kill(pid);
    }

}