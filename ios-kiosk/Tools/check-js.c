// Parse a production bundle with the device's JavaScriptCore, without executing it.
#include <JavaScriptCore/JavaScriptCore.h>
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char **argv) {
    if (argc != 2) { fputs("Usage: check-js bundle.js\n", stderr); return 2; }
    FILE *file = fopen(argv[1], "rb");
    if (!file) return 2;
    if (fseek(file, 0, SEEK_END) != 0) { fclose(file); return 2; }
    long length = ftell(file);
    if (length < 0 || length > 4 * 1024 * 1024) { fclose(file); return 2; }
    rewind(file);
    char *source = calloc((size_t)length + 1, 1);
    if (!source) { fclose(file); return 2; }
    size_t read = fread(source, 1, (size_t)length, file);
    fclose(file);
    if (read != (size_t)length) { free(source); return 2; }
    JSGlobalContextRef context = JSGlobalContextCreate(NULL);
    JSStringRef script = JSStringCreateWithUTF8CString(source);
    free(source);
    JSValueRef exception = NULL;
    bool valid = JSCheckScriptSyntax(context, script, NULL, 1, &exception);
    puts(valid ? "PASS: device JavaScriptCore accepted bundle syntax" : "FAIL: device JavaScriptCore rejected bundle syntax");
    JSStringRelease(script);
    JSGlobalContextRelease(context);
    return valid ? 0 : 1;
}
