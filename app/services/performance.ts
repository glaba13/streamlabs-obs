import Vue from 'vue';
import { Subject } from 'rxjs/Subject';

import { StatefulService, mutation } from './stateful-service';
import { nodeObs } from './obs-api';
import electron from 'electron';

interface IPerformanceState {
  CPU: number;
  numberDroppedFrames: number;
  percentageDroppedFrames: number;
  bandwidth: number;
  frameRate: number;
}

const STATS_UPDATE_INTERVAL = 2 * 1000;

// TODO: merge this service with PerformanceMonitorService

// Keeps a store of up-to-date performance metrics
export class PerformanceService extends StatefulService<IPerformanceState> {

  static initialState: IPerformanceState = {
    CPU: 0,
    numberDroppedFrames: 0,
    percentageDroppedFrames: 0,
    bandwidth: 0,
    frameRate: 0
  };

  droppedFramesDetected = new Subject<number>();
  private intervalId: number;

  @mutation()
  private SET_PERFORMANCE_STATS(stats: IPerformanceState) {
    Object.keys(stats).forEach(stat => {
      Vue.set(this.state, stat, stats[stat]);
    });
  }

  init() {
    electron.ipcRenderer.on('notifyPerformanceStatistics', (e: Electron.Event, stats: IPerformanceState) => {
      this.processPerformanceStats(stats);
    });

    this.intervalId = window.setInterval(() => {
      electron.ipcRenderer.send('requestPerformanceStatistics');
    }, STATS_UPDATE_INTERVAL);
  }

  processPerformanceStats(stats: IPerformanceState) {
    if (stats.percentageDroppedFrames) {
      this.droppedFramesDetected.next(stats.percentageDroppedFrames / 100);
    }

    stats.CPU += electron.remote.app.getAppMetrics().map(proc => {
      return proc.cpu.percentCPUUsage;
    }).reduce((sum, usage) => sum + usage);

    this.SET_PERFORMANCE_STATS(stats);
  }

  stop() {
    clearInterval(this.intervalId);
    this.SET_PERFORMANCE_STATS(PerformanceService.initialState);
  }

}
