import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './app/router'
import { initializeTheme } from './shared/theme/useTheme'

initializeTheme()

const app = createApp(App)

app.use(router)

app.mount('#app')
