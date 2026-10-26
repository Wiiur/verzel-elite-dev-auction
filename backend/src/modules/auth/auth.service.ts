import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: {
    name: string;
    email: string;
    password: string;
    role: Role;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new BadRequestException('Este e-mail já está registado.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const randomTag = crypto.randomBytes(2).toString('hex').toUpperCase();
    const prefix = dto.role === Role.AUCTIONEER ? 'Leiloeiro' : 'Licitante';
    const publicAlias = `${prefix} #${randomTag}`;

    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email: dto.email.toLowerCase().trim(),
        passwordHash,
        role: dto.role,
        publicAlias,
      },
    });

    return this.generateTokenResponse(user);
  }

  async login(dto: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    return this.generateTokenResponse(user);
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        publicAlias: true,
        email: true,
        role: true,
        totalBalance: true,
        committedBalance: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Utilizador não encontrado.');
    }

    return {
      ...user,
      availableBalance: user.totalBalance - user.committedBalance,
    };
  }

  private generateTokenResponse(user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    publicAlias: string;
  }) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      publicAlias: user.publicAlias,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        publicAlias: user.publicAlias,
      },
    };
  }
}