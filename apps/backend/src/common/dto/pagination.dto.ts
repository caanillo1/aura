import { Type } from 'class-transformer';
import { IsOptional, IsPositive, Max, Min, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(500)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Texto libre para filtrar' })
  @IsOptional()
  @IsString()
  search?: string;
}

export function paginate(page = 1, limit = 20) {
  const take = limit;
  const skip = (page - 1) * limit;
  return { take, skip };
}

export function buildMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
