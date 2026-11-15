package app.velora.test;

import android.graphics.Color;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Capacitor first: it leaves the launch theme for the app's own theme and puts the web page on screen.
        super.onCreate(savedInstanceState);
        // Only then: the page draws behind the status and navigation bars and keeps its own safe margins
        // (styles.css, html.native). Light icons on both bars, because the app is always dark.
        // Never before super.onCreate: touching the window that early builds it with the LAUNCH theme, which on
        // Android 12 and newer has a title bar. That was the stray bar with the stretched launch picture that
        // Robert found on his phone on 15 Nov 2026.
        EdgeToEdge.enable(this, SystemBarStyle.dark(Color.TRANSPARENT), SystemBarStyle.dark(Color.TRANSPARENT));
    }
}
