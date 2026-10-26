import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  Body,
  CanActivate,
  Controller,
  Delete,
  ExecutionContext,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsModule } from '../permissions/permissions.module';
import { PermissionsService } from '../permissions/permissions.service';
import { PropertiesModule } from '../properties/properties.module';
import { SiteApiService } from '../properties/site-api.service';
@Injectable()
export class BlogAccessGuard implements CanActivate {
  constructor(private readonly permissions: PermissionsService) {}
  async canActivate(context: ExecutionContext) {
    const user = context.switchToHttp().getRequest().user;
    if (await this.permissions.hasPermission(user.id, 'blog.manage'))
      return true;
    throw new ForbiddenException('Blog management permission is required');
  }
}
@Controller('api/v1/blog')
@UseGuards(JwtAuthGuard, BlogAccessGuard)
export class BlogController {
  constructor(private readonly site: SiteApiService) {}
  @Post('image')
  @UseInterceptors(
    FilesInterceptor('image', 1, {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  async upload(@UploadedFiles() files: Express.Multer.File[]) {
    const file = files?.[0];
    if (
      !file ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
    )
      throw new BadRequestException(
        'Choose a JPEG, PNG or WebP image up to 5 MB',
      );
    return {
      success: true,
      data: await this.site.uploadImage(
        '/admin/editorial/image',
        file.buffer,
        file.mimetype,
      ),
    };
  }
  private contentFields(dto: Record<string, unknown>) {
    return Object.fromEntries(
      [
        'title',
        'excerpt',
        'content',
        'category',
        'cover_image',
        'cover_alt',
        'status',
        'revision',
      ]
        .filter((key) => dto[key] !== undefined)
        .map((key) => [key, dto[key]]),
    );
  }
  @Get() async list(@Query('page') page = '1') {
    return {
      success: true,
      data: await this.site.get(
        `/admin/editorial?page=${encodeURIComponent(page)}`,
      ),
    };
  }
  @Get(':id') async details(@Param('id', ParseIntPipe) id: number) {
    return {
      success: true,
      data: await this.site.get(`/admin/editorial/${id}`),
    };
  }
  @Post() async create(@Body() dto: Record<string, unknown>) {
    return {
      success: true,
      data: await this.site.post('/admin/editorial', {
        ...this.contentFields(dto),
        author_name: 'Majestan Realty',
      }),
    };
  }
  @Put(':id') async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Record<string, unknown>,
  ) {
    return {
      success: true,
      data: await this.site.put(
        `/admin/editorial/${id}`,
        this.contentFields(dto),
      ),
    };
  }
  @Delete(':id') async remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('revision', ParseIntPipe) revision: number,
  ) {
    return {
      success: true,
      data: await this.site.del(`/admin/editorial/${id}?revision=${revision}`),
    };
  }
}
@Module({
  imports: [AuthModule, PermissionsModule, PropertiesModule],
  controllers: [BlogController],
  providers: [BlogAccessGuard],
})
export class BlogModule {}
