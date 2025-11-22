| Компонент                      | Что делаем                                | Библиотека / Технология                   |
| ------------------------------ | ----------------------------------------- | ----------------------------------------- |
| **chart.tsx**                  | Полный переход                            | **ECharts**                               |
| **select.tsx**                 | Переписываем                              | **@zag-js/select** + UnoCSS               |
| **dropdown-menu.tsx**          | MVP-минимум → позже расширяем             | **Floating UI** + *позже* @zag-js/menu    |
| **SimpleList / UniversalList** | Оставляем, конвертация на Voby            | **Свой UI**, без React                    |
| **drawer.tsx**                 | Заменяем                                  | **Zag.js gestures** + Floating UI overlay |
| **command.tsx**                | Удаляем из системы                        | ❌                                         |
| **sheet.tsx**                  | Удаляем, логика переходит в Drawer/Mobile | ❌ или Floating UI                         |
| **sidebar.tsx**                | Переписываем ядро **layout**              | **Effector Layout Framework**             |
| **sonner.tsx**                 | Переписываем                              | **Floating UI Toaster**                   |
| **table/**                     | Adaptive Table                            | **TanStack Virtual + Voby Signals**       |
