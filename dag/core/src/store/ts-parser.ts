import { parse } from '@typescript-eslint/typescript-estree';

export function extractConstructorParams(code: string): Array<{name: string, type?: string}> {
    const ast = parse(code);
    
    // Найти класс (может быть в ExportDefaultDeclaration)
    let classDeclaration;
    for (const node of ast.body) {
        if (node.type === 'ClassDeclaration') {
            classDeclaration = node;
            break;
        } else if (node.type === 'ExportDefaultDeclaration' && node.declaration.type === 'ClassDeclaration') {
            classDeclaration = node.declaration;
            break;
        }
    }
    
    if (!classDeclaration) return [];
    
    // Найти конструктор
    const constructor = classDeclaration.body.body.find(
        node => node.type === 'MethodDefinition' && node.key.name === 'constructor'
    );
    
    if (!constructor) return [];
    
    // Извлечь параметры
    return constructor.value.params.map(param => {
        if (param.type === 'TSParameterProperty') {
            // public name: string
            const name = param.parameter.name;
            const typeAnnotation = param.parameter.typeAnnotation?.typeAnnotation;
            let type;
            
            if (typeAnnotation?.type === 'TSStringKeyword') type = 'string';
            else if (typeAnnotation?.type === 'TSNumberKeyword') type = 'number';
            else if (typeAnnotation?.type === 'TSBooleanKeyword') type = 'boolean';
            else if (typeAnnotation?.type === 'TSAnyKeyword') type = 'any';
            else type = 'any';
            
            return { name, type };
        } else {
            // обычный параметр
            const name = param.name;
            const typeAnnotation = param.typeAnnotation?.typeAnnotation;
            let type;
            
            if (typeAnnotation?.type === 'TSStringKeyword') type = 'string';
            else if (typeAnnotation?.type === 'TSNumberKeyword') type = 'number';
            else if (typeAnnotation?.type === 'TSBooleanKeyword') type = 'boolean';
            else if (typeAnnotation?.type === 'TSAnyKeyword') type = 'any';
            else type = 'any';

            return { name, type };
        }
    });
}

