import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CronogramaService } from './cronograma.service';
import { CronogramaController, CronogramaPublicController } from './cronograma.controller';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MailModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'aura_secret',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [CronogramaPublicController, CronogramaController],
  providers: [CronogramaService],
})
export class CronogramaModule {}
