// Deliberately illustrative: no fabricated prices, availability or nutrition.
export const demoPack = {
  schemaVersion: 1,
  source: { kind: 'demo', storeName: '午休演示菜单', fetchedAt: '', tools: [] },
  items: [
    ['d1', '巨无霸', '汉堡'], ['d2', '双层吉士汉堡', '汉堡'],
    ['d3', '板烧鸡腿堡', '汉堡'], ['d4', '麦辣鸡腿汉堡', '汉堡'],
    ['d5', '麦香鱼', '汉堡'], ['d6', '麦香鸡', '汉堡'],
    ['d7', '薯条', '小食'], ['d8', '麦乐鸡', '小食'],
    ['d9', '玉米杯', '小食'], ['d10', '苹果片', '小食'],
    ['d11', '可口可乐', '饮品'], ['d12', '雪碧', '饮品'],
    ['d13', '美式咖啡', '饮品'], ['d14', '拿铁', '饮品'],
    ['d15', '圆筒冰淇淋', '甜品'], ['d16', '麦旋风', '甜品'],
    ['d17', '香芋派', '甜品'], ['d18', '菠萝派', '甜品']
  ].map(([id, name, category]) => ({ id, name, category }))
};
