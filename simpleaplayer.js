/*
 krpanoJS javascript plugin Simple Audio Player
 Плагин предназначен для воспроизведения звуков.

 Использование:
 */

var krpanoplugin = function() {
	var local = this;
	// save the 'this' pointer from the current plugin object

	var krpano = null;
	// the krpano and plugin interface objects
	var plugin = null;

//	var plugincanvas = null;
	// optionally - a canvas object for graphic content
//	var plugincanvascontext = null;

	// registerplugin - startup point for the plugin (required)
	// - krpanointerface = krpano interface object
	// - pluginpath = string with the krpano path of the plugin (e.g. "plugin[pluginname]")
	// - pluginobject = the plugin object itself (the same as: pluginobject = krpano.get(pluginpath) )
	local.registerplugin = function(krpanointerface, pluginpath, pluginobject) {
		krpano = krpanointerface;
		plugin = pluginobject;

		krpano.simpleaplayer = pluginobject;

		// Регистрация атрибутов
		plugin.registerattribute("allowMultuSounds", false, set_allowMultuSounds, get_allowMultuSounds);
		plugin.registerattribute("volume",           80,    set_volume,           get_volume);

		// Регистрация методов
		/* !Важно: регистрируем функции не в плгине (plugin),
		 * а в объекте krpano, чтобы они были доступны везде
		 */
		krpanointerface.playsound = playSound;
		krpanointerface.stopallsounds = stopAllSounds;
		krpanointerface.stopsound = stopSound;
		krpanointerface.preloadsound = preloadSound;

		// say hello
		krpano.trace(1, "hello from plugin[" + plugin.name + "]");

		local.initialization();

		krpano.trace(3, 'DEBUG12');

		/*
		 // add plugin graphic content (optionally)
		 var havegraphiccontent = false;
		 if (havegraphiccontent) // this code here is only an example for how-to add addtional graphical content!
		 {
		 // register the size of the plugin content
		 // e.g. to set the plugin source size to 256x256 pixels:
		 plugin.registercontentsize(256,256);

		 plugincanvas = document.createElement("canvas");
		 plugincanvas.width  = 256;
		 plugincanvas.height = 256;
		 plugincanvas.style.width  = "100%";  // automatic scale with parent
		 plugincanvas.style.height = "100%";
		 plugincanvas.onselectstart = function() { return false; };  // fix select mouse cursor

		 // the plugin "sprite" variable holds the visible html element
		 // - it can be used to add elements or events
		 plugin.sprite.appendChild(plugincanvas);

		 // draw something on the canvas
		 // ...
		 }
		 */
	}

	// unloadplugin - end point for the plugin (optionally)
	// - will be called from krpano when the plugin will be removed
	// - everything that was added by the plugin (objects,intervals,...) should be removed here
	local.unloadplugin = function() {
		plugin = null;
		krpano = null;

		_audioContext = null;
		_volume = 80;
		_allowMultuSounds = false;
	}
	// hittest - test for clicks on the plugin (optionally)
	// - when the plugin has a graphical irregular shape then it's possible to check here for mouse clicks on it
	// - the typical usage is to check for a hit on the canvas element
	local.hittest = function(x, y) {
		if (plugincanvascontext) {
			return plugincanvascontext.isPointInPath(x, y);
		}

		return false;
	}
	// onresize - the plugin was resized from xml krpano (optionally)
	// - width,height = the new size for the plugin
	// - when not defined then only the parent html element will be scaled
	local.onresize = function(width, height) {
		// not used in this example

		return false;
	}
	
	local.initialization = function() {
		// Определяем какие звуковые форматы воспроизводит браузер
		var audio = document.createElement("audio");
		var result = audio.canPlayType("audio/mpeg");
		if (result.match(/maybe|probably/i))
			_extension.push('mp3', 'mp2', 'mpa'); 

		result = audio.canPlayType("audio/ogg");
		if (result.match(/maybe|probably/i))
			_extension.push('ogg', 'oga', 'ogv');

		result = audio.canPlayType("audio/mp4");
		if (result.match(/maybe|probably/i))
			_extension.push('mp4', 'mv4');

		result = audio.canPlayType("audio/wav");
		if (result.match(/maybe|probably/i))
			_extension.push('wav');

		audio = null;
		krpano.trace(1, "Список поддерживаемых форматов: " + _extension);

		// Инициализация звукового движка
		try {
			window.AudioContext = window.AudioContext || window.webkitAudioContext;
			_audioContext = new AudioContext();
		} catch(e) {
			krpano.trace(2, e.message);
		}

		if (_audioContext) {
			krpano.trace(1, 'Создан объект AudioContext из Audio API');
		} else {
			krpano.trace(1, 'Браузер не поддерживает Audio API');
		}
	}

	// Закрытые данные
	// Данные относящиеся к воспроизведению звука
	// Аудио контекст
	var _audioContext = null;
	// Уровень громкости [0, 100]
	var _volume = 80;
	// Разрешать воспроизведение нескольких звуков однвременно.
	var _allowMultuSounds = true;
	// Массив звуков
	/*
	 * [id] // Уникальный идентификатор звука (задается/вычисляется)
	 *      // Загрузка данных производиться при первом обращении playsound или preloadsound,
	 * 		// при последующих обращениях загрузка производиться не будет,
	 *      // а будет использованы те данные которые были получены при первом обращении
	 *  {
	 * 		buffer: {},       // Буферр декодированных и готовых к воспроизведению данных
	 * 		source: {},       // Источник зывука, не равен нулю, когда было запущено воспроизведение
	 * 		play: true|false, // Флаг, используется для запуска на воспроизведение
	 *                        // по окончанию асинхронной загрузки данных
	 *  }
	 */
	var _sounds = [];
	/*
	 * Список поддерживаемых расширений звуковых файлов, в порядке предпочтения
	 */
	var _extension = [];
	/*
	 * Флаг для отслеживания специальных действий для iOS (планшет)
	 */
	var _audioBufferInitHack = false;

	// Функции для работы со свойствами
	function set_allowMultuSounds(newvalue) {
		//       krpano.trace(1,"attr4 will be changed from " + attr4 + " to " + newvalue);
		_allowMultuSounds = newvalue;
	}

	function get_allowMultuSounds() {
		return _allowMultuSounds;
	}

	function set_volume(newvalue) {
		//       krpano.trace(1,"attr4 will be changed from " + attr4 + " to " + newvalue);
		_volume = newvalue;
	}

	function get_volume() {
		return _volume;
	}
	
	/*  
	 * Смикшировать/сгенерировать идентификатор (для однозначного определения звука)
	 */
	function makeId(id) {
		id = String(id).toLowerCase();
		if ("auto" == id || "null" == id || "" == id)
			id = "autoId_" + krpano.timertick + "_" + Math.ceil(1E3 * krpano.random);

		return id;
	}

	////////////////////////////////////////////////////////////
	// Интерфейс плагина
	function playSound(id, src) {
		krpano.trace(0, "playSound(" + id + ", " + src + ")");

		id = makeId(id);

		if (!_allowMultuSounds)
			stopAllSounds();
		else
			stopSound(id);

		if (!_sounds[id]) {
			preloadSound(id, src);
			if (_sounds[id])
				_sounds[id].play = true;
		} else {
	  		if (_sounds[id].buffer) {
	  			try {
					var source = _audioContext.createBufferSource();
					source.connect(_audioContext.destination);
					source.buffer = _sounds[id].buffer;
					_sounds[id].source = source;
					_sounds[id].source.start(0);
	  			}
	  			catch(e) {
	  				krpano.trace(0, e.message);
	  			}
	  		}
	  		else {
	  			_sounds[id].play = true;
	  		}
	  	}
	  	
		return id;
	}

	function stopAllSounds() {
		krpano.trace(0, "stopAll");

		for (var iter in _sounds)
			stopSound(iter);
	}

	function stopSound(id) {
		krpano.trace(0, "stopSound(" + id + ")");

		if (_sounds[id]) try {
			_sounds[id].play = false;
			if (_sounds[id].source) {
				_sounds[id].source.stop(0);
				_sounds[id].source = null;
			}
		} catch(e) { krpano.trace(0, e.message); }
	}

	function preloadSound(id, src) {
		krpano.trace(0, "preloadSound(" + id + ", " + src + ")");

		id = makeId(id);

		src = src.split("|");

		var url = "";
		var index = _extension.length + 1;

		for(var i = 0; i < src.length; i++) {
			var ext = src[i].slice(src[i].lastIndexOf(".") + 1);
			var ind = _extension.indexOf(ext);
			if(ind >= 0 && ind < index) {
				index = ind;
				url = unescape(krpano.parsePath(src[i]));
			}
		}

		if (url == "") {
			krpano.trace(2, "Форматы не поддерживаеются: " + src);
			return;
		}

		if (!_sounds[id]) {
			// Создаем объект
			_sounds[id] = {};
			
krpano.trace(0, "Дуболь № 30");
			
        	if (!_audioBufferInitHack) {
        		// Это важно для iOS - для того что бы все работало необходимо 
        		// чтобы в интерфейсном потоке был один раз был создан BufferSource,
        		// после этого его можно создавать как угодно.
        		var source = _audioContext.createBufferSource();
        		source = null;
        		_audioBufferInitHack = true;
        	}

			// делаем XMLHttpRequest (AJAX) на сервер
	  		var xhr = new XMLHttpRequest();
	  		xhr.open('GET', url, true);
	  		xhr.responseType = 'arraybuffer'; // важно
	  		xhr.onload = function(e) {
	    		// декодируем бинарный ответ
	    		_audioContext.decodeAudioData(
	    			this.response,
	    			function(decodedArrayBuffer) {
	    				_sounds[id].buffer = decodedArrayBuffer;	    				
	    				if (_sounds[id].play) try {
							playSound(id);
	      				} catch (e) { krpano.trace(3, 'Error: ' + e); }
	    			},
	    			function(e) {
	    				delete sounds[id];
	      				krpano.trace(3, 'Error decoding file: ' + e);
	    			}
	    		);
	  		};
	  		xhr.onerror = function(e) {
				delete sounds[id];
				krpano.trace(3, 'Error ' + e.target.status + ' occurred while receiving the audio file - ' + url + '.');
	  		};
	  		// Отправка запроса
	  		xhr.send();
		}
	}
}; 