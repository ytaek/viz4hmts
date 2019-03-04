import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpModule } from '@angular/http';
import { AppComponent } from './app.component';
import { MainComponent } from './main/main.component';
import { MatSliderModule } from '@angular/material/slider';
import { FormsModule } from '@angular/forms';
import 'hammerjs/hammer';
import { Phase2Component } from './phase2/phase2.component';
import { AppRouterModule } from './app.router.module';

@NgModule({
  declarations: [
    AppComponent,
    MainComponent,
    Phase2Component
  ],
  imports: [
    HttpModule,
    BrowserModule,
    MatSliderModule,
    FormsModule,
    AppRouterModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
