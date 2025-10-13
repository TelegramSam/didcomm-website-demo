import { createRouter, createWebHistory } from 'vue-router';
import DesktopView from './views/DesktopView.vue';
import MobileView from './views/MobileView.vue';
import AdvancedView from './views/AdvancedView.vue';

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
    },
    {
      path: '/mobile/advanced',
      name: 'advanced',
      component: AdvancedView
    }
  ]
});

export default router;
