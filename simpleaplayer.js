/*
 krpanoJS javascript plugin Simple Audio Player
 Плагин предназначен для воспроизведения звуков.
 
 Павел Горнин, pg@yandex.ru

 Использование:
 */

var krpanoplugin = function() {
	var local = this;
	// save the 'this' pointer from the current plugin object

	var krpano = null;
	// the krpano and plugin interface objects
	var plugin = null;

	/*
	 * Список поддерживаемых расширений звуковых файлов, в порядке предпочтения
	 */
	var _extension = [];

	/*
	 * Реализация воспроизведения звуков
	 * audioAPIImpl - через audio API
	 *              - через HTML5 элемент <audio>
	 */
	var _audioImpl = null;

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

		// say hello
		krpano.trace(1, "hello from plugin[" + plugin.name + "]");

		local.initialization();

		// Регистрация атрибутов
		plugin.registerattribute("allowMultuSounds", false, set_allowMultuSounds, get_allowMultuSounds);
		plugin.registerattribute("volume",           80,    set_volume,           get_volume);

		// Регистрация методов
		/* !Важно: регистрируем функции не в плгине (plugin),
		 * а в объекте krpano, чтобы они были доступны везде
		 */
		krpanointerface.playsound     = playSound;
		krpanointerface.stopallsounds = stopAllSounds;
		krpanointerface.stopsound     = stopSound;
		krpanointerface.preloadsound  = preloadSound;

		krpano.trace(3, 'Дуболь №36');

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

		delete _audioImpl;
		_audioImpl = null;
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
			var audioContext = new AudioContext();
			_audioImpl = new audioAPIImpl(audioContext, 80, false)
		} catch(e) {
			krpano.trace(2, e.message);
		}
	}

	/*
	 *  Реализация воспроизведения звука через audio API
	 *  @param audioContext     - объект AudioContext.
	 *  @param volume           - уровень громкости (может изменяться в ходе рвботы).
	 *  @param allowMultuSounds - разрешить воспроизведение нескольких звуков одновременно.
	 */
	var audioAPIImpl = function(audioContext, volume, allowMultuSounds) {
		// private:
		// Данные относящиеся к воспроизведению звука
		// Аудио контекст
		var _audioContext = audioContext;
		// Уровень громкости [0, 100]
		var _volume = volume;
		// Разрешать воспроизведение нескольких звуков однвременно.
		var _allowMultuSounds = allowMultuSounds;
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
	 	* Флаг для отслеживания специальных действий для iOS (планшет)
	 	*/
		var _audioBufferInitHack = false;

		krpano.trace(1, 'Создан объект AudioContext из Audio API');

		////////////////////////////////////////////////////////////
		// Интерфейс плагина
		this.playSound = function(id, src) {
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
						if (!_sounds[id].gain) {
							_sounds[id].gain = _audioContext.createGain();
		  					_sounds[id].gain.gain.value = _volume / 100.0;
		  					_sounds[id].gain.connect(_audioContext.destination);
		  				}
						source.connect(_sounds[id].gain);
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

		this.stopAllSounds = function() {
			krpano.trace(0, "stopAll");

			for (var iter in _sounds)
				stopSound(iter);
		}

		this.stopSound = function(id) {
			krpano.trace(0, "stopSound(" + id + ")");

			if (_sounds[id]) try {
				_sounds[id].play = false;
				if (_sounds[id].source) {
					_sounds[id].source.stop(0);
					_sounds[id].source = null;
				}
			} catch(e) { krpano.trace(0, e.message); }
		}

		this.preloadSound = function(id, src) {
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

		// Функции для работы со свойствами
		this.set_allowMultuSounds = function(allowMultuSounds) {
			_allowMultuSounds = allowMultuSounds;
		}

		this.get_allowMultuSounds = function() {
			return _allowMultuSounds;
		}

		this.set_volume = function(volume) {
			_volume = parseFloat(volume);
			if (_volume < 0) _volume = 0;
			if (_volume > 100) _volume = 100.0;
	
			for (var iter in _sounds) {
				if (_sounds[iter].gain) {
					_sounds[iter].gain.gain.value = _volume / 100.0;
				}
			}
		}

		this.get_volume = function() {
			return _volume;
		}
	}

	// Функции для работы со свойствами
	function set_allowMultuSounds(allowMultuSounds) {
		try {
			_audioImpl ?
				_audioImpl.set_allowMultuSounds(allowMultuSounds) :
				krpano.trace(2, "_audioImpl == null");
		} catch(e) {
			krpano.trace(2, e.message);
		}		
	}

	function get_allowMultuSounds() {
		try {
			return _audioImpl ?
				_audioImpl.get_allowMultuSounds() :
				krpano.trace(2, "_audioImpl == null");
		} catch(e) {
			krpano.trace(2, e.message);
		}
	}

	function set_volume(volume) {
		try {
			_audioImpl ?
				_audioImpl.set_volume(volume) :
				krpano.trace(2, "_audioImpl == null");
		} catch(e) {
			krpano.trace(2, e.message);
		}
	}

	function get_volume() {
		try {
			return _audioImpl ?
				_audioImpl.get_volume() :
				krpano.trace(2, "_audioImpl == null");
		} catch(e) {
			krpano.trace(2, e.message);
		}
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
	//
	function playSound(id, src) {
		try {
			if (_audioImpl)
				return _audioImpl.playSound(id, src)
			else
				krpano.trace(2, "_audioImpl == null");
		} catch(e) {
			krpano.trace(2, e.message);
		}
	}

	function stopAllSounds() {
		try {
			if (_audioImpl)
				_audioImpl.stopAllSounds()
			else
				krpano.trace(2, "_audioImpl == null");
		} catch(e) {
			krpano.trace(2, e.message);
		}
	}

	function stopSound(id) {
		try {
			if (_audioImpl)
				_audioImpl.stopSound(id)
			else
				krpano.trace(2, "_audioImpl == null");
		} catch(e) {
			krpano.trace(2, e.message);
		}
	}

	function preloadSound(id, src) {
		try {
			if (_audioImpl)
				_audioImpl.preloadSound(id, src)
			else
				krpano.trace(2, "_audioImpl == null");
		} catch(e) {
			krpano.trace(2, e.message);
		}
	}
};
