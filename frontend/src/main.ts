import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { importDevTokenFromUrl } from './utils/dev-token'
import 'vant/lib/index.css'
import './styles/index.css'

importDevTokenFromUrl()

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
