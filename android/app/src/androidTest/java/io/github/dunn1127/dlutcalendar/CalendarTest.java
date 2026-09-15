package io.github.dunn1127.dlutcalendar;

import android.net.Uri;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.rule.ActivityTestRule;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.UiDevice;
import androidx.test.uiautomator.UiObject2;
import androidx.test.uiautomator.Until;
import java.io.File;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class CalendarTest {
    @Rule public ActivityTestRule<MainActivity> rule = new ActivityTestRule<>(MainActivity.class);
    private String js(String expression) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        rule.getActivity().runOnUiThread(() -> rule.getActivity().web.evaluateJavascript(expression,
            value -> { result.set(value); done.countDown(); }));
        assertTrue("JavaScript callback timed out", done.await(10, TimeUnit.SECONDS));
        return result.get();
    }
    private void awaitJs(String expression) throws Exception {
        long deadline = System.currentTimeMillis() + 60000;
        while (System.currentTimeMillis() < deadline) {
            if ("true".equals(js(expression))) return;
            Thread.sleep(500);
        }
        fail("Page condition not reached: " + expression + " at " + js("document.body.innerText.slice(0,800)"));
    }
    @Test public void browseFavoriteAndSaveCalendar() throws Exception {
        UiDevice device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        awaitJs("!!document.querySelector('#sync-meta') && document.querySelector('#sync-meta').textContent.includes('最近成功同步')");
        assertEquals("true", js("!!window.AndroidCalendar?.postMessage"));
        assertEquals("true", js("document.documentElement.scrollWidth <= innerWidth"));
        File folder = rule.getActivity().getExternalFilesDir(null);
        device.takeScreenshot(new File(folder, "android-home.png"));
        js("localStorage.clear(); location.reload()");
        awaitJs("!!document.querySelector('#favorite-total') && document.querySelector('#favorite-total').textContent === '0' && document.querySelector('#sync-meta').textContent.includes('最近成功同步')");
        js("(()=>{const s=document.querySelector('#search-filter');s.value='ZZZ-no-match-XYZ';s.dispatchEvent(new Event('input',{bubbles:true}));})()");
        awaitJs("!!document.querySelector('.empty-reset')");
        js("document.querySelector('.empty-reset').click();document.querySelectorAll('[data-date]')[2].click()");
        awaitJs("!!document.querySelector('.event-card__open')");
        js("document.querySelector('.event-card__open').click()");
        awaitJs("!!document.querySelector('.detail-panel')");
        device.takeScreenshot(new File(folder, "android-detail.png"));
        js("[...document.querySelectorAll('.detail-panel button')].find(b=>b.textContent==='收藏活动').click()");
        awaitJs("document.querySelector('#favorite-total').textContent==='1'");
        js("[...document.querySelectorAll('.detail-panel button')].find(b=>b.textContent==='导出单场日历').click()");
        UiObject2 save = device.wait(Until.findObject(By.res("com.google.android.documentsui", "action_menu_save")), 15000);
        if (save == null) save = device.wait(Until.findObject(By.text("SAVE")), 5000);
        assertNotNull("Android document save picker did not open", save);
        device.takeScreenshot(new File(folder, "android-save-picker.png"));
        save.click();
        Thread.sleep(2000);
        String saved = device.executeShellCommand("cat /sdcard/Download/dlut-*.ics");
        assertTrue("Export file missing: " + saved, saved.contains("BEGIN:VCALENDAR"));
        assertTrue(saved.contains("BEGIN:VEVENT"));
        assertTrue(saved.contains("TZID:Asia/Shanghai"));
        js("location.reload()");
        awaitJs("!!document.querySelector('#favorite-total') && document.querySelector('#favorite-total').textContent==='1'");
    }
    @Test public void restrictNavigationToCalendar() {
        assertTrue(MainActivity.isCalendarUrl(Uri.parse(MainActivity.HOME)));
        assertFalse(MainActivity.isCalendarUrl(Uri.parse("https://dunn1127.github.io/another-project/")));
        assertFalse(MainActivity.isCalendarUrl(Uri.parse("https://dunn1127.github.io.evil.example/dlut-career-calendar/")));
        assertFalse(MainActivity.isCalendarUrl(Uri.parse("http://dunn1127.github.io/dlut-career-calendar/")));
        assertFalse(MainActivity.isCalendarUrl(Uri.parse("file:///data/local/file")));
    }
}
