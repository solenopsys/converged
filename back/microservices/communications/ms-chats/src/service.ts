import type {
  ChartsService,
  ChartRoom,
  ChartRoomId,
  ChartRoomRole,
  ChartRoomsListParams,
  ChartRoomsListResult,
  ChartRoomUser,
  ChartUserId,
  CreateChartRoomInput,
  UpdateChartRoomInput,
} from "./types";
import { StoresController } from "./stores";

const MS_ID = "charts-ms";

export class ChartsServiceImpl implements ChartsService {
  private stores: StoresController;
  private initPromise?: Promise<void>;

  constructor() {
    this.init();
  }

  private async init() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      this.stores = new StoresController(MS_ID);
      await this.stores.init();
    })();

    return this.initPromise;
  }

  private async ready(): Promise<void> {
    await this.init();
  }

  async createRoom(input: CreateChartRoomInput): Promise<ChartRoom> {
    await this.ready();
    return this.stores.charts.createRoom(input);
  }

  async getRoom(roomId: ChartRoomId): Promise<ChartRoom | null> {
    await this.ready();
    return this.stores.charts.getRoom(roomId);
  }

  async updateRoom(roomId: ChartRoomId, patch: UpdateChartRoomInput): Promise<ChartRoom> {
    await this.ready();
    return this.stores.charts.updateRoom(roomId, patch);
  }

  async deleteRoom(roomId: ChartRoomId): Promise<boolean> {
    await this.ready();
    return this.stores.charts.deleteRoom(roomId);
  }

  async listRooms(params: ChartRoomsListParams): Promise<ChartRoomsListResult> {
    await this.ready();
    return this.stores.charts.listRooms(params);
  }

  async addRoomUser(roomId: ChartRoomId, userId: ChartUserId, role?: ChartRoomRole): Promise<void> {
    await this.ready();
    return this.stores.charts.addRoomUser(roomId, userId, role);
  }

  async removeRoomUser(roomId: ChartRoomId, userId: ChartUserId): Promise<void> {
    await this.ready();
    return this.stores.charts.removeRoomUser(roomId, userId);
  }

  async listRoomUsers(roomId: ChartRoomId): Promise<ChartRoomUser[]> {
    await this.ready();
    return this.stores.charts.listRoomUsers(roomId);
  }

  async listUserRooms(userId: ChartUserId, params: ChartRoomsListParams): Promise<ChartRoomsListResult> {
    await this.ready();
    return this.stores.charts.listUserRooms(userId, params);
  }
}

export default ChartsServiceImpl;
