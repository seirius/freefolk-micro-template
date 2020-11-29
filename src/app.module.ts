import { Module } from '@nestjs/common';
import { DefaultModule } from './default/default.module';
import { DispatcherModule } from './dispatcher/dispatcher.module';

@Module({
    imports: [DefaultModule, DispatcherModule],
    controllers: [],
    providers: [],
})
export class AppModule { }
