import { BlogAccessGuard } from './blog.module';
describe('Blog access', () => {
  it('checks the current user permission on the server', async () => {
    const hasPermission = jest.fn().mockResolvedValue(false);
    const guard = new BlogAccessGuard({ hasPermission } as any);
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user: { id: 42 } }) }),
    } as any;
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Blog management permission is required',
    );
    expect(hasPermission).toHaveBeenCalledWith(42, 'blog.manage');
    hasPermission.mockResolvedValue(true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});

import { BlogController } from './blog.module';
describe('CRM blog content ownership', () => {
  it('uses the organization author and excludes SEO and supplied author fields', async () => {
    const post = jest.fn().mockResolvedValue({ id: 1 });
    const controller = new BlogController({ post } as any);
    await controller.create({
      title: 'Article',
      excerpt: 'Description',
      content: '<p>Text</p>',
      category: 'Buying guides',
      cover_image: '',
      cover_alt: '',
      status: 'draft',
      author_name: 'Forged author',
      meta_title: 'SEO overwrite',
      published_at: '2099-01-01',
    });
    expect(post).toHaveBeenCalledWith(
      '/admin/editorial',
      expect.objectContaining({
        author_name: 'Majestan Realty',
        title: 'Article',
      }),
    );
    const payload = post.mock.calls[0][1];
    expect(payload).not.toHaveProperty('meta_title');
    expect(payload).not.toHaveProperty('published_at');
  });
  it('does not forward SEO fields when updating content', async () => {
    const put = jest.fn().mockResolvedValue({ id: 1 });
    const controller = new BlogController({ put } as any);
    await controller.update(1, {
      title: 'Article',
      revision: 2,
      noindex: true,
      meta_title: 'Overwrite',
      slug: 'changed',
      author_name: 'Impersonated',
    });
    expect(put).toHaveBeenCalledWith('/admin/editorial/1', {
      title: 'Article',
      revision: 2,
    });
  });
});
