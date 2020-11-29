import * as env from "env-var";
import { config as envConfig } from "dotenv";
envConfig();

export class DatabaseConfig {

    public static TYPE: string = env.get("DB_TYPE", "PostgreSQL").asString();
    public static HOST: string = env.get("DB_HOST", "localhost").asString();
    public static PORT: number = env.get("DB_PORT", "5432").asPortNumber();
    public static USERNAME: string = env.get("DB_USERNAME").asString();
    public static PASSWORD: string = env.get("DB_PASSWORD").asString();
    public static SCHEMA: string = env.get("DB_SCHEMA").asString();
    public static INSTANCE: string = env.get("DB_INSTANCE").asString();

}