package app.velora.test;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The page draws behind the status and navigation bars and keeps its own safe margins (see styles.css, html.native).
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
    }
}
