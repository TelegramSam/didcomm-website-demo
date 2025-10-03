import { createRouter, createWebHistory } from 'vue-router';
import DesktopView from './views/DesktopView.vue';
import MobileView from './views/MobileView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'desktop',
      component: DesktopView
    },
    {
      path: '/mobile',
      name: 'mobile',
      component: MobileView
    }
  ]
});

export default router;
