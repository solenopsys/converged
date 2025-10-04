
// Примеры использования:

// 1. Простой ключ (number)
interface User {
    id: number;
    name: string;
    email: string;
  }
  
  const userRepository = new KyselyRepository<number, User>(
    db,
    'users',
    {
      primaryKey: 'id',
      extractKey: (user) => user.id,
      buildWhereCondition: (id) => ({ id })
    }
  );
  
  // 2. Составной ключ (объект)
  interface CompositeKey {
    userId: number;
    projectId: number;
  }
  
  interface UserProject {
    userId: number;
    projectId: number;
    role: string;
    joinedAt: Date;
  }
  
  const userProjectRepository = new KyselyRepository<CompositeKey, UserProject>(
    db,
    'user_projects',
    {
      primaryKey: ['userId', 'projectId'],
      extractKey: (entity) => ({ 
        userId: entity.userId, 
        projectId: entity.projectId 
      }),
      buildWhereCondition: (key) => ({
        userId: key.userId,
        projectId: key.projectId
      })
    }
  );
  
  // 3. Строковый ключ
  interface Article {
    slug: string;
    title: string;
    content: string;
  }
  
  const articleRepository = new KyselyRepository<string, Article>(
    db,
    'articles',
    {
      primaryKey: 'slug',
      extractKey: (article) => article.slug,
      buildWhereCondition: (slug) => ({ slug })
    }
  );
  
  // Использование:
  // await userRepository.findById(42);
  // await userProjectRepository.findById({ userId: 1, projectId: 5 });
  // await articleRepository.findById('my-article-slug');