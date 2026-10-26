import { Controller, Get, Param } from '@nestjs/common';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('lots/:lotId')
  auditLotHistory(@Param('lotId') lotId: string) {
    return this.auditService.auditLot(lotId);
  }

  @Get('receipts/:id')
  getReceipt(@Param('id') id: string) {
    return this.auditService.getPublicReceipt(id);
  }
}