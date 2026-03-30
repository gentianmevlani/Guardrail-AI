
import { semanticSearchService } from '../src/lib/semantic-search-service';

// Mock test function to expose private method
const getClasses = (content: string) => {
    return (semanticSearchService as any).extractClasses(content);
};

describe('SemanticSearchService Class Extraction', () => {
    it('should extract methods from TypeScript class', () => {
        const content = `
      class TestClass {
        constructor() {
          this.value = 1;
        }

        public method1() {
          return 'method1';
        }

        private method2(arg: string) {
          return arg;
        }

        async asyncMethod() {
          return await Promise.resolve();
        }
      }
      `;

        const classes = getClasses(content);
        expect(classes).toHaveLength(1);
        expect(classes[0].name).toBe('TestClass');
        expect(classes[0].methods).toHaveLength(3);
        expect(classes[0].methods).toContain('method1');
        expect(classes[0].methods).toContain('method2');
        expect(classes[0].methods).toContain('asyncMethod');
    });

    it('should extract methods from Python class', () => {
        const content = `
class PythonClass:
    def method1(self):
        pass

    def method2(self, arg):
        return arg
      `;

        const classes = getClasses(content);
        expect(classes).toHaveLength(1);
        expect(classes[0].name).toBe('PythonClass');
        expect(classes[0].methods).toHaveLength(2);
        expect(classes[0].methods).toContain('method1');
        expect(classes[0].methods).toContain('method2');
    });
});
