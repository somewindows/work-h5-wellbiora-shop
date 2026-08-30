import { config } from 'dotenv'

/**
 * 必须在导入 AppModule 前执行：动态模块会在装配阶段读取 LOCAL_TEST_MODE。
 */
config({ quiet: true })
