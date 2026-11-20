package android.util;
import java.util.LinkedHashMap;
import java.util.Map;
public class LruCache<K,V> {
    private final int maxSize;
    private final LinkedHashMap<K,V> map=new LinkedHashMap<>(16,0.75f,true);
    public LruCache(int maxSize){this.maxSize=Math.max(1,maxSize);}
    protected int sizeOf(K key,V value){return 1;}
    public synchronized V get(K key){return map.get(key);}
    public synchronized V put(K key,V value){return map.put(key,value);}
    public synchronized void evictAll(){map.clear();}
    public synchronized int size(){int n=0;for(Map.Entry<K,V> e:map.entrySet())n+=sizeOf(e.getKey(),e.getValue());return n;}
}
