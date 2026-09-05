package live.germaniya.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // O'z plaginimiz — dars videosi ochilganda ekranni himoyalaydi.
        // Ro'yxatdan o'tkazish super.onCreate DAN OLDIN bo'lishi shart:
        // ko'prik (bridge) o'sha yerda quriladi va keyin qo'shilgan plagin
        // veb tomonga ko'rinmay qoladi.
        registerPlugin(ScreenGuardPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
