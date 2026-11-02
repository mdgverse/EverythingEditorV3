package br.com.mdgverse.everythingeditor;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Ponte de salvamento exposta ao JavaScript como window.AndroidSave.
 *
 * O editor (camada mobile) chama:
 *   begin(nome, mime) -> id (>= 0) | -1
 *   chunk(id, base64)
 *   end(id)
 *
 * Os bytes vão para Downloads/Everything Editor/ pelo MediaStore, sem pedir
 * permissão de armazenamento (Android 10+).
 */
public class SaveBridge {

    private static final String TAG = "EverythingEditorSave";
    private static final String FOLDER = Environment.DIRECTORY_DOWNLOADS + "/Everything Editor";

    private static final class Item {
        OutputStream out;
        Uri uri;
        String name;
    }

    private final MainActivity activity;
    private final Map<Integer, Item> open = new HashMap<>();
    private int nextId = 1;

    SaveBridge(MainActivity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public synchronized int begin(String name, String mime) {
        String safe = sanitize(name);
        String type = (mime == null || mime.isEmpty()) ? "application/octet-stream" : mime;
        try {
            ContentValues cv = new ContentValues();
            cv.put(MediaStore.Downloads.DISPLAY_NAME, safe);
            cv.put(MediaStore.Downloads.MIME_TYPE, type);
            cv.put(MediaStore.Downloads.RELATIVE_PATH, FOLDER);
            cv.put(MediaStore.Downloads.IS_PENDING, 1);

            ContentResolver cr = activity.getContentResolver();
            Uri uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
            if (uri == null) {
                toast("Não foi possível criar o arquivo.", true);
                return -1;
            }

            Item item = new Item();
            item.uri = uri;
            item.name = safe;
            item.out = cr.openOutputStream(uri);
            if (item.out == null) {
                cr.delete(uri, null, null);
                toast("Não foi possível abrir o arquivo para escrita.", true);
                return -1;
            }

            int id = nextId++;
            open.put(id, item);
            return id;
        } catch (Exception e) {
            Log.e(TAG, "begin failed", e);
            toast("Falha ao salvar: " + e.getClass().getSimpleName(), true);
            return -1;
        }
    }

    @JavascriptInterface
    public synchronized void chunk(int id, String base64) {
        Item item = open.get(id);
        if (item == null || item.out == null || base64 == null) return;
        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            item.out.write(bytes);
        } catch (Exception e) {
            Log.e(TAG, "chunk failed", e);
        }
    }

    @JavascriptInterface
    public synchronized void end(int id) {
        Item item = open.remove(id);
        if (item == null) return;
        try {
            if (item.out != null) {
                item.out.flush();
                item.out.close();
            }
            // Torna o arquivo visível (sai do estado "pendente").
            ContentValues cv = new ContentValues();
            cv.put(MediaStore.Downloads.IS_PENDING, 0);
            activity.getContentResolver().update(item.uri, cv, null, null);
            toast("Salvo em Downloads/Everything Editor/" + item.name, false);
        } catch (Exception e) {
            Log.e(TAG, "end failed", e);
            toast("Falha ao finalizar o arquivo.", true);
        }
    }

    // ------------------------------------------------------------------ helpers

    private static String sanitize(String name) {
        String base = (name == null || name.trim().isEmpty()) ? "arquivo" : name.trim();
        base = base.replaceAll("[\\\\/:*?\"<>|]", "_");
        if (base.length() > 120) base = base.substring(base.length() - 120);
        return base;
    }

    private void toast(final String msg, final boolean error) {
        activity.runOnUiThread(() -> {
            try {
                Toast.makeText(activity, msg, error ? Toast.LENGTH_LONG : Toast.LENGTH_SHORT).show();
            } catch (Exception ignored) {
                // atividade já encerrada
            }
        });
    }
}
