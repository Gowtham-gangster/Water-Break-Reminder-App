package com.pauseflow.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PauseFlowNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
