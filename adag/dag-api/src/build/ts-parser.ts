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
    
    // Функция для извлечения типа из TypeAnnotation
    function extractType(typeAnnotation: any): string {
        if (!typeAnnotation) return 'any';
        
        if (typeAnnotation.type === 'TSStringKeyword') return 'string';
        else if (typeAnnotation.type === 'TSNumberKeyword') return 'number';
        else if (typeAnnotation.type === 'TSBooleanKeyword') return 'boolean';
        else if (typeAnnotation.type === 'TSAnyKeyword') return 'any';
        else return 'any';
    }
    
    // Извлечь параметры
    return constructor.value.params.map(param => {
        if (param.type === 'TSParameterProperty') {
            // public name: string
            let actualParam = param.parameter;
            
            // Если параметр имеет дефолтное значение, он оборачивается в AssignmentPattern
            if (actualParam.type === 'AssignmentPattern') {
                actualParam = actualParam.left;
            }
            
            const name = actualParam.name;
            const typeAnnotation = actualParam.typeAnnotation?.typeAnnotation;
            const type = extractType(typeAnnotation);
            
            return { name, type };
        } else {
            // обычный параметр
            let actualParam = param;
            
            // Если параметр имеет дефолтное значение, он оборачивается в AssignmentPattern
            if (param.type === 'AssignmentPattern') {
                actualParam = param.left;
            }
            
            const name = actualParam.name;
            const typeAnnotation = actualParam.typeAnnotation?.typeAnnotation;
            const type = extractType(typeAnnotation);

            return { name, type };
        }
    });
}