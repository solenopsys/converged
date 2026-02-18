// access.decorator.test.ts
import { SignJWT } from 'jose';
import { Access, UserController } from './access.decorator';


const JWT_SECRET = new TextEncoder().encode('your-secret-key');

describe('Access Decorator', () => {
  let controller: UserController;
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    controller = new UserController();
    mockReq = { headers: {}, user: undefined };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  it('should allow access with valid token', async () => {
    const token = await new SignJWT({ sub: '123' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(JWT_SECRET);

    mockReq.headers.authorization = `Bearer ${token}`;

    await controller.getProfile(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({ userId: '123' });
  });

  it('should reject without token', async () => {
    await controller.getProfile(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token' });
  });

  it('should reject invalid token', async () => {
    mockReq.headers.authorization = 'Bearer invalid';

    await controller.getProfile(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
  });
});