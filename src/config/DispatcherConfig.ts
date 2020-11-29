import * as env from "env-var";
import { config as envConfig } from "dotenv";
envConfig();

export class DispatcherConfig {
    public static readonly UNATTACHED = env.get("UNATTACHED", "false").asBool();
    public static readonly ENABLE_API = env.get("ENABLE_API", "true").asBool();
    public static readonly KRAKEN_SOCKET_CHANNEL = env.get("KRAKEN_SOCKET_CHANNEL", "message").asString();

    public static AGENT_ID = env.get("AGENT_ID").asString();

    public static readonly TYPE: string = env.get("TYPE", "SEDA_BATCH").asString();
    public static readonly HOST: string = env.get("HOST", "localhost").asString();
    public static readonly PORT: number = env.get("PORT", "8080").asPortNumber();

    public static readonly KRAKEN_SOCKET_URL: string = env.get("KRAKEN_URL", "http://localhost:9092").asString();

    public static readonly BATCH_EXE_PATH: string = env
        .get("BATCH_EXE_PATH", "/home/andriy/.wine/drive_c/Program Files (x86)/Notepad++/notepad++.exe")
        .asString();


    public static readonly TRACK_STATS = env.get("TRACK_STATS", "true").asBool();
    public static readonly TRACK_STATS_INVERVAL: number = env
        .get("TRACK_STATS_INVERVAL", "5000")
        .asInt();
}