package com.sudhanshu.mathsbj;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/** Compile-time and deterministic desktop fixture; never included in the Android application. */
final class WidgetScreenTimeRepository {
    static volatile String fixtureStatus="ok";
    static final class Snapshot { final String status, period; Snapshot(String s,String p){status=s;period=p;} }
    static void setFixtureStatus(String status){fixtureStatus=status==null?"ok":status;}
    static void invalidateCaches() {}
    static boolean hasUsageAccess(Context context){return !"permission_required".equals(fixtureStatus);}
    static Snapshot getCachedSnapshot(Context context,String period){return new Snapshot(fixtureStatus,period);}
    static void requestRefresh(Context context,String period,Runnable callback){if(callback!=null)callback.run();}
    static MathMasterWidgetRenderer.ScreenTimeSection buildSection(Context context,Snapshot snapshot,boolean study,String sort,int maxEntries) {
        return buildSection(context,snapshot,study,sort,maxEntries,Collections.emptySet());
    }
    static MathMasterWidgetRenderer.ScreenTimeSection buildSection(Context context,Snapshot snapshot,boolean study,String sort,int maxEntries,Set<String> hidden) {
        MathMasterWidgetRenderer.ScreenTimeSection section=new MathMasterWidgetRenderer.ScreenTimeSection();
        section.title=study?"Study Apps":"Device Apps";
        section.periodLabel="today".equals(snapshot==null?"today":snapshot.period)?"Today":"last_7_days".equals(snapshot.period)?"Last 7 Days":"Yesterday";
        section.lastUpdatedAt=System.currentTimeMillis();
        if("permission_required".equals(fixtureStatus)){section.status="permission_required";return section;}
        if("no_study_apps".equals(fixtureStatus)&&study){section.status="no_study_apps";return section;}
        if("no_usage".equals(fixtureStatus)){section.status="no_usage";return section;}
        if("loading".equals(fixtureStatus)){section.status="loading";return section;}
        if("error".equals(fixtureStatus)){section.status="error";return section;}
        section.status="ok";
        String[] labels={"Math Notes","Long Study Companion Name","Calculator","Focus Timer","Flashcards","Study Planner"};
        long[] millis={7260000L,5460000L,3120000L,1860000L,960000L,420000L};
        long total=0L;for(int i=0;i<labels.length;i++)if(hidden==null||!hidden.contains("com.fixture."+i))total+=millis[i];
        section.totalUsageMillis=total;
        int count=Math.min(Math.max(1,maxEntries),labels.length);
        for(int i=0;i<count;i++){
            if(hidden!=null&&hidden.contains("com.fixture."+i))continue;
            MathMasterWidgetRenderer.ScreenTimeEntry e=new MathMasterWidgetRenderer.ScreenTimeEntry();
            e.packageName="com.fixture."+i;e.label=labels[i];e.usageMillis=millis[i];e.percent=total==0?0f:(float)(millis[i]*100d/total);
            e.icon=Bitmap.createBitmap(24,24,Bitmap.Config.ARGB_8888);
            Canvas c=new Canvas(e.icon);Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);p.setColor(new int[]{0xFF4CC9F0,0xFF9575CD,0xFF4CAF50,0xFFFFB74D,0xFFEC407A,0xFF26A69A}[i]);c.drawCircle(12,12,10,p);
            section.entries.add(e);
        }
        return section;
    }
}
