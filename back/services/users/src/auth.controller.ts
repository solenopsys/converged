 
import { getDefaultUsersDatabaseService } from "./db";


// Auth controller
export const authController = {
	async getProfile({ user, set }: any) {
		try {
			const dbService = getDefaultUsersDatabaseService();
			const userData = await dbService.users.findById(user.id);
			
			if (!userData) {
				set.status = 404;
				return { error: "User not found" };
			}

			// Получаем также атрибуты пользователя
			const userAttributes = await dbService.userAttributes.findByUser(user.id);

			return {
				user: userData,
				attributes: userAttributes?.attributes || null
			};
		} catch (error) {
			console.error("Error getting user profile:", error);
			set.status = 500;
			return { error: "Internal server error" };
		}
	},

	async updateProfile({ user, body, set }: any) {
		try {
			const dbService = getDefaultUsersDatabaseService();
			
			// Обновляем основные данные пользователя
			const updatedUser = await dbService.users.update(user.id, {
				name: body.name,
				email: body.email,
			});

			if (!updatedUser) {
				set.status = 404;
				return { error: "User not found" };
			}

			// Обновляем атрибуты если они переданы
			if (body.attributes) {
				await dbService.userAttributes.upsert({
					user_id: user.id,
					attributes: body.attributes
				});
			}

			return { 
				message: "Profile updated successfully",
				user: updatedUser 
			};
		} catch (error) {
			console.error("Error updating user profile:", error);
			set.status = 500;
			return { error: "Internal server error" };
		}
	},

	async getUserById({ params: { id }, set }: any) {
		try {
			const dbService = getDefaultUsersDatabaseService();
			const user = await dbService.users.findById(id);
			
			if (!user) {
				set.status = 404;
				return { error: "User not found" };
			}

			const userAttributes = await dbService.userAttributes.findByUser(id);

			return {
				user,
				attributes: userAttributes?.attributes || null
			};
		} catch (error) {
			console.error("Error getting user by ID:", error);
			set.status = 500;
			return { error: "Internal server error" };
		}
	},

	async listUsers({ query, set }: any) {
		try {
			const dbService = getDefaultUsersDatabaseService();
			const limit = query.limit ? parseInt(query.limit) : undefined;
			const offset = query.offset ? parseInt(query.offset) : undefined;

			const users = await dbService.users.list(limit, offset);
			const totalCount = await dbService.users.count();

			return {
				users,
				pagination: {
					total: totalCount,
					limit: limit || totalCount,
					offset: offset || 0
				}
			};
		} catch (error) {
			console.error("Error listing users:", error);
			set.status = 500;
			return { error: "Internal server error" };
		}
	},

	async deleteUser({ params: { id }, set }: any) {
		try {
			const dbService = getDefaultUsersDatabaseService();
			
			// Используем транзакцию для удаления пользователя и его атрибутов
			const result = await dbService.transaction(async (trx) => {
				// Удаляем атрибуты пользователя
				await trx
					.deleteFrom("user_attributes")
					.where("user_id", "=", id)
					.execute();

				// Удаляем самого пользователя
				const deletedUser = await trx
					.deleteFrom("users")
					.where("id", "=", id)
					.returningAll()
					.executeTakeFirst();

				return deletedUser;
			});

			if (!result) {
				set.status = 404;
				return { error: "User not found" };
			}

			return { 
				message: "User deleted successfully",
				deletedUser: result 
			};
		} catch (error) {
			console.error("Error deleting user:", error);
			set.status = 500;
			return { error: "Internal server error" };
		}
	},

	async createUser({ body, set }: any) {
		try {
			const dbService = getDefaultUsersDatabaseService();
			
			// Проверяем, что пользователь с таким email не существует
			const existingUser = await dbService.users.findByEmail(body.email);
			if (existingUser) {
				set.status = 409;
				return { error: "User with this email already exists" };
			}

			const newUser = await dbService.users.create({
				name: body.name,
				email: body.email,
				password_hash: body.password_hash, // Предполагаем, что пароль уже захеширован
			});

			// Создаем атрибуты если они переданы
			if (body.attributes) {
				await dbService.userAttributes.create({
					user_id: newUser.id,
					attributes: body.attributes
				});
			}

			return { 
				message: "User created successfully",
				user: {
					id: newUser.id,
					name: newUser.name,
					email: newUser.email,
					created_at: newUser.created_at,
					updated_at: newUser.updated_at
				}
			};
		} catch (error) {
			console.error("Error creating user:", error);
			set.status = 500;
			return { error: "Internal server error" };
		}
	}
};
