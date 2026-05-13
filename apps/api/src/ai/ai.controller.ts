import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AIService } from './ai.service.js';

const aiPromptSchema = z.object({
  prompt: z.string().min(1),
  mode: z.enum(['ask', 'generate', 'automate']).default('generate'),
  boardId: z.string().uuid(),
  selectedIds: z.array(z.string().uuid()).optional(),
});

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AIController {
  constructor(
    private aiService: AIService,
    private prisma: PrismaService,
  ) {}

  @Post('prompt')
  async prompt(@Body() body: unknown, @Req() req: any) {
    const data = aiPromptSchema.parse(body);
    const board = await this.prisma.board.findUnique({
      where: { id: data.boardId },
      include: { elements: { where: { deletedAt: null } } },
    });
    if (!board) return { error: 'Board not found' };

    const actions = await this.aiService.process({
      prompt: data.prompt,
      mode: data.mode,
      boardContext: {
        boardName: board.name,
        elements: board.elements as any,
        selectedIds: data.selectedIds,
      },
    });

    await this.prisma.history.create({
      data: {
        action: 'ai.prompt',
        payload: { prompt: data.prompt, actions } as any,
        boardId: data.boardId,
        userId: req.user.userId,
      },
    });

    return { actions };
  }

  @Post('actions/summarize')
  async summarize(@Body() body: any) {
    const schema = z.object({ boardId: z.string().uuid(), elementIds: z.array(z.string().uuid()) });
    const { elementIds } = schema.parse(body);
    const elements = await this.prisma.element.findMany({ where: { id: { in: elementIds } } });
    const texts = elements.map((el) => (el.data as any)?.text ?? '').filter(Boolean);
    return { summary: this.aiService.summarize(texts), elementCount: elements.length };
  }

  @Post('actions/cluster')
  async cluster(@Body() body: any) {
    const schema = z.object({ boardId: z.string().uuid(), elementIds: z.array(z.string().uuid()) });
    const { elementIds } = schema.parse(body);
    const elements = await this.prisma.element.findMany({ where: { id: { in: elementIds } } });
    const clusters = [
      { label: 'Ideias', ids: elements.filter((_, i) => i % 3 === 0).map((e) => e.id) },
      { label: 'Ações', ids: elements.filter((_, i) => i % 3 === 1).map((e) => e.id) },
      { label: 'Riscos', ids: elements.filter((_, i) => i % 3 === 2).map((e) => e.id) },
    ].filter((c) => c.ids.length > 0);
    return { clusters };
  }
}
