// src/controllers/auth.controller.ts
import { authService } from "../services/auth.service";
import { users } from "../db";

export const authController = {
	async register({ body }: any) {
		const user = await authService.register(
			body.email,
			body.password,
			body.name,
		);
		return { user };
	},

	async login({ body }: any) {
		const result = await authService.login(body.email, body.password);
		return result;
	},

	async logout({ headers }: any) {
		const token = headers.authorization?.replace("Bearer ", "");
		if (!token) throw new Error("No token provided");

		const hasher = new Bun.CryptoHasher("sha256");
		hasher.update(token);
		const tokenHash = hasher.digest("hex");

		await authService.logout(tokenHash);
		return { success: true };
	},

	async getProfile({ userId }: any) {
		const user = await users.findById(userId).executeTakeFirst();

		if (!user) throw new Error("User not found");
		return { user };
	},

	async updateProfile({ userId, body }: any) {
		const user = await users.findById(userId).executeTakeFirst();
		if (!user) throw new Error("User not found");

		// Update user data
		await users
			.update(userId, {
				name: body.name !== undefined ? body.name : user.name,
				email: body.email !== undefined ? body.email : user.email,
			})
			.execute();

		// Get updated user
		const updatedUser = await users.findById(userId).executeTakeFirst();
		return { user: updatedUser };
	},

	async deleteAccount({ userId }: any) {
		const user = await users.findById(userId).executeTakeFirst();
		if (!user) throw new Error("User not found");

		// Delete user (cascade will handle auth_methods, sessions, etc.)
		await users.delete(userId).execute();

		return { success: true };
	},

	async validateToken({ headers }: any) {
		const token = headers.authorization?.replace("Bearer ", "");
		if (!token) throw new Error("No token provided");

		const hasher = new Bun.CryptoHasher("sha256");
		hasher.update(token);
		const tokenHash = hasher.digest("hex");

		const session = await authService.validateSession(tokenHash);
		if (!session) throw new Error("Invalid token");

		const user = await users.findById(session.user_id).executeTakeFirst();
		if (!user) throw new Error("User not found");

		return { user, session };
	},
};
