import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: ['dueDate must be on or after invoiceDate'],
    description: 'A message, or one message per invalid field for validation errors.',
  })
  message: string | string[];

  @ApiProperty({ example: 'Bad Request' })
  error: string;
}
