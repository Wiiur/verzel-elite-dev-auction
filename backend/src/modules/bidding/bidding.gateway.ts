import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class BiddingGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('join_lot')
  handleJoinLot(
    @MessageBody() data: { lotId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`lot:${data.lotId}`);
    return { event: 'joined', room: `lot:${data.lotId}` };
  }

  @SubscribeMessage('leave_lot')
  handleLeaveLot(
    @MessageBody() data: { lotId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`lot:${data.lotId}`);
  }

  broadcastNewBid(lotId: string, payload: any) {
    this.server.to(`lot:${lotId}`).emit('bid_placed', payload);
  }

  broadcastLotStatusChange(lotId: string, payload: any) {
    this.server.to(`lot:${lotId}`).emit('lot_status_changed', payload);
  }
}