function loadLibrary() {
   const libraryUrl = document.getElementById('libraryUrl').value;
   const status = document.getElementById('status');
   
   if (!libraryUrl) {
       status.innerHTML = '<p class="error">Пожалуйста, введите URL библиотеки</p>';
       return;
   }

   // Создаем новый элемент script
   const script = document.createElement('script');
   script.src = libraryUrl;
   script.async = true;

   // Обработчики успешной загрузки и ошибки
   script.onload = function() {
       status.innerHTML = `<p class="success">Библиотека успешно загружена: ${libraryUrl}</p>`;
   };

   script.onerror = function() {
       status.innerHTML = `<p class="error">Ошибка при загрузке библиотеки: ${libraryUrl}</p>`;
   };

   // Добавляем script элемент в документ
   document.head.appendChild(script);
}

if ('serviceWorker' in navigator) {
   navigator.serviceWorker.register('./sw.js')
       .then((registration) => {
           console.log('Service Worker успешно зарегистрирован со статусом:', registration.active ? 'active' : 'pending');
       })
       .catch(error => {
           console.error('Ошибка при регистрации Service Worker:', error);
           console.error('Полный текст ошибки:', error.message);
       });
} else {
   console.error('Service Worker не поддерживается вашим браузером.');
}
   