import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards, UseInterceptors, UploadedFile, Request, ForbiddenException, ParseIntPipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto, SelfUpdateDto } from './dto/self-update.dto';
import { MAX_AVATAR_BYTES } from './user-avatars.service';

const isAdmin = (req: any) => {
  const role = req?.user?.role?.name ?? req?.user?.role;
  return role === 'Admin' || role === 'Super Admin';
};

/** Admins change anyone's photo; everyone else only their own. */
function mayChangePhoto(req: any, id: number) {
  if (isAdmin(req) || Number(req?.user?.id) === id) return;
  throw new ForbiddenException('You can only change your own photo');
}

@Controller('api/v1/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly service: UsersService) {}

  // Personal details (phone, address, Aadhaar, bank) are for admins, and for
  // each person's own record; everyone else sees name, role, team and photo.
  @Get()
  async findAll(@Request() req: any) {
    const data = await this.service.findAll(isAdmin(req));
    return { success: true, data };
  }

  /** Everyone's photo, so names across the CRM can show a face. */
  @Get('photos')
  async photos() {
    const data = await this.service.photos();
    return { success: true, data };
  }

  /** The signed-in user's full record, for Settings. */
  @Get('me')
  async me(@Request() req: any) {
    const data = await this.service.findOne(Number(req.user.id), true);
    return { success: true, data };
  }

  @Patch('me')
  async updateMe(@Request() req: any, @Body() body: SelfUpdateDto) {
    const data = await this.service.updateSelf(Number(req.user.id), body);
    return { success: true, data };
  }

  @Post('me/password')
  async changePassword(@Request() req: any, @Body() body: ChangePasswordDto) {
    await this.service.changePassword(Number(req.user.id), body.current, body.next);
    return { success: true };
  }

  @Get('me/onboarding')
  async onboarding(@Request() req: any) {
    const data = await this.service.onboarding(Number(req.user.id));
    return { success: true, data };
  }

  @Patch('me/onboarding')
  async updateOnboarding(@Request() req: any, @Body() body: Record<string, unknown>) {
    const data = await this.service.updateOnboarding(Number(req.user.id), body ?? {});
    return { success: true, data };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    const data = await this.service.findOne(Number(id), isAdmin(req) || Number(req?.user?.id) === Number(id));
    return { success: true, data };
  }

  @Post()
  @Roles('Admin')
  async create(@Body() body: CreateUserDto) {
    const data = await this.service.create(body);
    return { success: true, data };
  }

  @Put(':id')
  @Roles('Admin')
  async update(@Param('id') id: string, @Body() body: UpdateUserDto) {
    const data = await this.service.update(Number(id), body);
    return { success: true, data };
  }

  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_AVATAR_BYTES, files: 1 } }))
  async uploadAvatar(@Param('id', ParseIntPipe) id: number, @UploadedFile() file: Express.Multer.File, @Request() req: any) {
    mayChangePhoto(req, id);
    const data = await this.service.setAvatar(id, file);
    return { success: true, data };
  }

  // A POST, not a DELETE: deletes are admin-only, and people may remove their own photo.
  @Post(':id/avatar/remove')
  async removeAvatar(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    mayChangePhoto(req, id);
    const data = await this.service.removeAvatar(id);
    return { success: true, data };
  }

  @Delete(':id')
  @Roles('Admin')
  async delete(@Param('id') id: string) {
    await this.service.delete(Number(id));
    return { success: true };
  }
}
