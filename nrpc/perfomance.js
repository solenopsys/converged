import {pack,unpack} from "msgpackr";
// Ваш объект
const obj = { id: 12345, name: "test user", active: true, score: 98.7 };

// Размер в байтах
console.log('JSON size:', JSON.stringify(obj).length);
console.log('msgpackr size:', pack(obj).length);

// Скорость (10k итераций)  
console.time('JSON');
for(let i = 0; i < 100000; i++) {
  const s = JSON.stringify(obj);
  JSON.parse(s);
}
console.timeEnd('JSON');

console.time('msgpackr');
for(let i = 0; i < 100000; i++) {
  const s = pack(obj);
  unpack(s);
}
console.timeEnd('msgpackr'); 