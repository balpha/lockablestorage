
/*
 LockableStorage.lock(key, lockAquiredCallback)
*/
(function () {

    function now() {
        return new Date().getTime();
    }
    
    function someNumber() {
        return Math.random() * 1000000000 | 0;
    }

    var myId = now() + ":" + someNumber();
        
    function getter(lskey) {
        return function () {
            var value = localStorage[lskey];
            if (!value)
                return null;
            
            var splitted = value.split(/\|/);
            if (parseInt(splitted[1]) < now()) {
                return null;
            }
            return splitted[0];
        }
    }
    
    function _mutexTransaction(key, callback) {
        var xKey = key + "__MUTEX_x",
            yKey = key + "__MUTEX_y",
            getY = getter(yKey);

        function criticalSection() {
            try {
                callback();
            } finally {
                localStorage.removeItem(yKey);
            }
        }
        
        localStorage[xKey] = myId;
        if (getY()) {
            setTimeout(function () { _mutexTransaction(key, callback); }, 0);
            return;
        }
        localStorage[yKey] = myId + "|" + (now() + 40);
        
        if (localStorage[xKey] !== myId) {
            setTimeout(function () {
                if (getY() !== myId) {
                    setTimeout(function () { _mutexTransaction(key, callback); }, 0);
                } else {
                    criticalSection();
                }
            }, 50)
        } else {
            criticalSection();
        }
    }
    
    function lock(key, callback, maxDuration) {

        maxDuration = maxDuration || 5000;
        
        var mutexKey = key + "__MUTEX",
            getMutex = getter(mutexKey),
            mutexValue = myId + ":" + someNumber() + "|" + (now() + maxDuration);
            
        function restart () {
            setTimeout(function () { lock(key, callback, maxDuration); }, 10);
        }
        
        if (getMutex()) {
            restart();
            return;
        }
        
        _mutexTransaction(key, function () {
            if (getMutex()) {
                restart();
                return;
            }
            localStorage[mutexKey] = mutexValue;
            setTimeout(mutexAquired, 0)
        });
        
        function mutexAquired() {
            try {
                callback();
            } finally {
                _mutexTransaction(key, function () {
                    if (localStorage[mutexKey] !== mutexValue)
                        throw key + " was locked by a different process while I held the lock"
                
                    localStorage.removeItem(mutexKey);
                });
            }
        }
        
    }
    
    window.LockableStorage = { lock: lock };
})();
