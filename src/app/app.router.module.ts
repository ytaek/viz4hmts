import { RouterModule, Routes } from '@angular/router';
import {Phase2Component} from './phase2/phase2.component';
import { MainComponent } from './main/main.component';

const AppRoutes: Routes = [
  // { path: '', redirectTo: 'main', pathMatch: 'full' }, // 첫 화면을 login 페이지로 설정
  { path: 'main', component: MainComponent },
  { path: 'phase2', component: Phase2Component, },
];

export const AppRouterModule = RouterModule.forRoot(AppRoutes, {useHash: true});