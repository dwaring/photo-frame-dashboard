#import "KioskController.h"
#import <WebKit/WebKit.h>
static NSString *const DefaultURL = @"https://home-dashboard.darrenwaring.workers.dev/#home";

@interface KioskController () <WKNavigationDelegate, WKUIDelegate, UIGestureRecognizerDelegate>
@property(nonatomic, strong) WKWebView *webView;
@property(nonatomic, strong) UILabel *message;
@property(nonatomic, strong) UIView *overlay;
@property(nonatomic, strong) NSTimer *retryTimer;
@property(nonatomic, strong) NSMutableArray<NSDate *> *failures;
@property(nonatomic, strong) NSMutableSet<NSString *> *approvedOrigins;
@property(nonatomic, strong) UIViewController *maintenance;
@property(nonatomic, strong) UITextField *urlField;
@property(nonatomic, strong) UILabel *details;
@property(nonatomic, copy) NSString *lastStatus;
@property(nonatomic) BOOL testing;
@property(nonatomic) BOOL active;
@property(nonatomic) BOOL isolationAvailable;
@property(nonatomic, copy) NSString *loadingReport;
@end

@implementation KioskController
- (void)viewDidLoad {
    [super viewDidLoad];
    self.failures = [NSMutableArray new];
    self.approvedOrigins = [NSMutableSet new];
    self.view.backgroundColor = [UIColor colorWithWhite:0.08 alpha:1];
    // Gate remote sign-in on an app-specific home, not the original /var/mobile home.
    self.isolationAvailable = [NSHomeDirectory() containsString:@"/Containers/Data/Application/"];
    WKWebViewConfiguration *configuration = [WKWebViewConfiguration new];
    configuration.websiteDataStore = WKWebsiteDataStore.defaultDataStore;
    self.webView = [[WKWebView alloc] initWithFrame:CGRectZero configuration:configuration];
    self.webView.navigationDelegate = self;
    self.webView.UIDelegate = self;
    self.webView.scrollView.contentInsetAdjustmentBehavior = UIScrollViewContentInsetAdjustmentNever;
    self.webView.scrollView.contentInset = UIEdgeInsetsZero;
    self.webView.scrollView.scrollIndicatorInsets = UIEdgeInsetsZero;
    self.webView.scrollView.bounces = NO;
    self.webView.translatesAutoresizingMaskIntoConstraints = NO;
    [self.view addSubview:self.webView];
    [NSLayoutConstraint activateConstraints:@[
        [self.webView.topAnchor constraintEqualToAnchor:self.view.topAnchor],
        [self.webView.bottomAnchor constraintEqualToAnchor:self.view.bottomAnchor],
        [self.webView.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
        [self.webView.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor]
    ]];
    self.overlay = [UIView new];
    self.overlay.backgroundColor = [UIColor colorWithWhite:0.08 alpha:0.96];
    self.overlay.translatesAutoresizingMaskIntoConstraints = NO;
    [self.view addSubview:self.overlay];
    self.message = [UILabel new];
    self.message.textColor = UIColor.whiteColor;
    self.message.numberOfLines = 0;
    self.message.textAlignment = NSTextAlignmentCenter;
    self.message.font = [UIFont systemFontOfSize:23];
    UIStackView *stack = [[UIStackView alloc] initWithArrangedSubviews:@[self.message, [self button:@"Maintenance" action:@selector(showMaintenance)]]];
    stack.axis = UILayoutConstraintAxisVertical;
    stack.spacing = 24;
    stack.translatesAutoresizingMaskIntoConstraints = NO;
    [self.overlay addSubview:stack];
    [NSLayoutConstraint activateConstraints:@[
        [self.overlay.topAnchor constraintEqualToAnchor:self.view.topAnchor],
        [self.overlay.bottomAnchor constraintEqualToAnchor:self.view.bottomAnchor],
        [self.overlay.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
        [self.overlay.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
        [stack.centerYAnchor constraintEqualToAnchor:self.overlay.centerYAnchor],
        [stack.leadingAnchor constraintEqualToAnchor:self.overlay.safeAreaLayoutGuide.leadingAnchor constant:40],
        [stack.trailingAnchor constraintEqualToAnchor:self.overlay.safeAreaLayoutGuide.trailingAnchor constant:-40]
    ]];
    UILongPressGestureRecognizer *gesture = [[UILongPressGestureRecognizer alloc] initWithTarget:self action:@selector(maintenanceGesture:)];
    gesture.numberOfTouchesRequired = 3;
    gesture.minimumPressDuration = 2;
    gesture.cancelsTouchesInView = NO;
    gesture.delegate = self;
    [self.view addGestureRecognizer:gesture];
    NSNotificationCenter *center = NSNotificationCenter.defaultCenter;
    [center addObserver:self selector:@selector(resigned) name:UIApplicationWillResignActiveNotification object:nil];
    [center addObserver:self selector:@selector(becameActive) name:UIApplicationDidBecomeActiveNotification object:nil];
    self.active = UIApplication.sharedApplication.applicationState == UIApplicationStateActive;
    [self loadDashboard];
}
- (void)dealloc { [NSNotificationCenter.defaultCenter removeObserver:self]; [self.retryTimer invalidate]; }
- (BOOL)prefersStatusBarHidden { return YES; }
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)gesture shouldRecognizeSimultaneouslyWithGestureRecognizer:(UIGestureRecognizer *)other { return YES; }
- (void)maintenanceGesture:(UILongPressGestureRecognizer *)gesture { if (gesture.state == UIGestureRecognizerStateBegan) [self showMaintenance]; }
- (UIButton *)button:(NSString *)title action:(SEL)action {
    UIButton *button = [UIButton buttonWithType:UIButtonTypeSystem];
    [button setTitle:title forState:UIControlStateNormal];
    button.titleLabel.font = [UIFont systemFontOfSize:20];
    [button.heightAnchor constraintEqualToConstant:48].active = YES;
    [button addTarget:self action:action forControlEvents:UIControlEventTouchUpInside];
    return button;
}
- (NSString *)configuredURL { return [NSUserDefaults.standardUserDefaults stringForKey:@"DashboardURL"] ?: DefaultURL; }
- (NSURL *)validatedURL:(NSString *)text {
    NSURLComponents *parts = [NSURLComponents componentsWithString:text];
    if (!parts.host.length || parts.user || parts.password || parts.query.length) return nil;
    if ([parts.scheme.lowercaseString isEqualToString:@"https"]) return parts.URL;
    NSString *host = parts.host.lowercaseString;
    // NSAllowsLocalNetworking permits .local/unqualified names, not arbitrary HTTP hosts.
    if ([parts.scheme.lowercaseString isEqualToString:@"http"] &&
        ([host hasSuffix:@".local"] || [host rangeOfString:@"."].location == NSNotFound) &&
        [host rangeOfString:@":"].location == NSNotFound) return parts.URL;
    return nil;
}
- (NSString *)origin:(NSURL *)url {
    if (!url.host.length) return @"";
    NSInteger port = url.port ? url.port.integerValue : ([url.scheme.lowercaseString isEqualToString:@"https"] ? 443 : 80);
    return [NSString stringWithFormat:@"%@://%@:%ld", url.scheme.lowercaseString, url.host.lowercaseString, (long)port];
}
- (NSString *)diagnosticText {
    return [NSString stringWithFormat:@"%@\nApp data home: %@\nAutomatic recoveries in last 5 minutes: %lu/3", self.lastStatus ?: @"Ready",
            self.isolationAvailable ? @"app-specific container" : @"missing — remote loading blocked", (unsigned long)self.failures.count];
}
- (void)setStatus:(NSString *)status visible:(BOOL)visible {
    self.lastStatus = status;
    self.message.text = status;
    self.overlay.hidden = !visible;
    self.details.text = [self diagnosticText];
}
- (void)cancelRetry { [self.retryTimer invalidate]; self.retryTimer = nil; }
- (void)resetRecovery { [self cancelRetry]; [self.failures removeAllObjects]; }
- (void)loadDashboard {
    [self resetRecovery];
    self.testing = NO;
    [self.approvedOrigins removeAllObjects];
    [self loadConfiguredRequest];
}
- (void)loadConfiguredRequest {
    if (!self.isolationAvailable) { [self setStatus:@"App data container missing. Use Maintenance → Test page. Remote loading is blocked pending installation repair." visible:YES]; return; }
    NSURL *url = [self validatedURL:[self configuredURL]];
    if (!url) { [self setStatus:@"Invalid dashboard URL. Open Maintenance to correct it." visible:YES]; return; }
    [self setStatus:@"Connecting…" visible:YES];
    [self.webView loadRequest:[NSURLRequest requestWithURL:url cachePolicy:NSURLRequestUseProtocolCachePolicy timeoutInterval:30]];
}
- (void)loadTest {
    [self resetRecovery];
    self.testing = YES;
    NSURL *url = [NSBundle.mainBundle URLForResource:@"test" withExtension:@"html"];
    if (!url) { [self setStatus:@"Bundled test page missing." visible:YES]; return; }
    [self.webView loadFileURL:url allowingReadAccessToURL:url];
}
- (void)retryFailure:(NSString *)reason {
    [self cancelRetry];
    NSDate *now = NSDate.date;
    while (self.failures.count && [now timeIntervalSinceDate:self.failures.firstObject] > 300) [self.failures removeObjectAtIndex:0];
    if (self.testing || self.failures.count >= 3 || !self.active || self.maintenance) {
        [self setStatus:[reason stringByAppendingString:@"\nAutomatic recovery paused. Use Maintenance to reload."] visible:YES]; return;
    }
    NSTimeInterval delays[] = {2, 5, 15};
    NSTimeInterval delay = delays[self.failures.count];
    [self.failures addObject:now];
    [self setStatus:[NSString stringWithFormat:@"%@\nRetrying in %.0f seconds…", reason, delay] visible:YES];
    self.retryTimer = [NSTimer scheduledTimerWithTimeInterval:delay target:self selector:@selector(retryNow:) userInfo:nil repeats:NO];
}
- (void)retryNow:(NSTimer *)timer { self.retryTimer = nil; if (self.active && !self.maintenance) [self loadConfiguredRequest]; }
- (void)resigned { self.active = NO; [self cancelRetry]; }
- (void)becameActive { self.active = YES; }
- (void)showMaintenance {
    if (self.presentedViewController) return;
    [self cancelRetry];
    self.maintenance = [UIViewController new];
    self.maintenance.title = @"Home Kiosk maintenance";
    self.maintenance.view.backgroundColor = UIColor.whiteColor;
    self.maintenance.navigationItem.rightBarButtonItem = [[UIBarButtonItem alloc] initWithBarButtonSystemItem:UIBarButtonSystemItemDone target:self action:@selector(closeMaintenance)];
    self.urlField = [UITextField new];
    self.urlField.text = [self configuredURL];
    self.urlField.borderStyle = UITextBorderStyleRoundedRect;
    self.urlField.keyboardType = UIKeyboardTypeURL;
    self.urlField.autocapitalizationType = UITextAutocapitalizationTypeNone;
    self.urlField.autocorrectionType = UITextAutocorrectionTypeNo;
    self.urlField.clearButtonMode = UITextFieldViewModeWhileEditing;
    [self.urlField.heightAnchor constraintEqualToConstant:48].active = YES;
    self.details = [UILabel new];
    self.details.numberOfLines = 0;
    self.details.text = [self diagnosticText];
    UILabel *label = [UILabel new];
    label.text = @"Dashboard URL (no credentials or query tokens)";
    UIStackView *stack = [[UIStackView alloc] initWithArrangedSubviews:@[label, self.urlField,
        [self button:@"Save URL and open dashboard" action:@selector(saveURL)],
        [self button:@"Reload configured dashboard" action:@selector(reloadFromMaintenance)],
        [self button:@"Test page (offline)" action:@selector(testFromMaintenance)],
        [self button:@"Inspect asset loading" action:@selector(captureLoadingDiagnostics)], self.details]];
    stack.axis = UILayoutConstraintAxisVertical;
    stack.spacing = 12;
    stack.translatesAutoresizingMaskIntoConstraints = NO;
    [self.maintenance.view addSubview:stack];
    UILayoutGuide *safe = self.maintenance.view.safeAreaLayoutGuide;
    [NSLayoutConstraint activateConstraints:@[
        [stack.topAnchor constraintEqualToAnchor:safe.topAnchor constant:20],
        [stack.leadingAnchor constraintEqualToAnchor:safe.leadingAnchor constant:24],
        [stack.trailingAnchor constraintEqualToAnchor:safe.trailingAnchor constant:-24]
    ]];
    UINavigationController *nav = [[UINavigationController alloc] initWithRootViewController:self.maintenance];
    nav.modalPresentationStyle = UIModalPresentationFormSheet;
    [self presentViewController:nav animated:YES completion:nil];
}
- (void)closeMaintenance { [self dismissViewControllerAnimated:YES completion:nil]; self.maintenance = nil; }
- (void)saveURL {
    NSString *text = [self.urlField.text stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
    if (![self validatedURL:text]) { self.details.text = @"Use HTTPS, or HTTP with a .local/unqualified LAN hostname. Credentials and query strings are not accepted."; return; }
    [NSUserDefaults.standardUserDefaults setObject:text forKey:@"DashboardURL"];
    [self reloadFromMaintenance];
}
- (void)reloadFromMaintenance { [self closeMaintenance]; [self loadDashboard]; }
- (void)testFromMaintenance { [self closeMaintenance]; [self loadTest]; }
- (void)captureLoadingDiagnostics {
    if (self.testing || ![self.webView.URL.host isEqualToString:[NSURL URLWithString:DefaultURL].host]) return;
    NSURL *source = [NSBundle.mainBundle URLForResource:@"loading-diagnostics" withExtension:@"js"];
    NSString *script = [NSString stringWithContentsOfURL:source encoding:NSUTF8StringEncoding error:nil];
    if (!script) return;
    [self.webView evaluateJavaScript:script completionHandler:^(id result, NSError *error) {
        if (!error) {
            [self saveLoadingDiagnostics];
            [self performSelector:@selector(saveLoadingDiagnostics) withObject:nil afterDelay:2];
            [self performSelector:@selector(saveLoadingDiagnostics) withObject:nil afterDelay:8.5];
        }
    }];
}
- (void)saveLoadingDiagnostics {
    if (![self.webView.URL.host isEqualToString:[NSURL URLWithString:DefaultURL].host]) return;
    [self.webView evaluateJavaScript:@"JSON.stringify(window.__homeKioskLoading || {})" completionHandler:^(id result, NSError *error) {
        if (error || ![result isKindOfClass:NSString.class]) return;
        self.loadingReport = result;
        NSString *cache = NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES).firstObject;
        [result writeToFile:[cache stringByAppendingPathComponent:@"homekiosk-loading.json"] atomically:YES encoding:NSUTF8StringEncoding error:nil];
        if (self.maintenance) self.details.text = [@"Asset loading report:\n" stringByAppendingString:result];
    }];
}
- (void)webView:(WKWebView *)webView didStartProvisionalNavigation:(WKNavigation *)navigation {
    // Authentication/setup pages retain normal root scrolling.
    webView.scrollView.scrollEnabled = YES;
    [self setStatus:@"Loading…" visible:YES];
}
- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation {
    [self cancelRetry];
    // Successful loads do not clear the rolling recovery budget (crash loops).
    [self setStatus:webView.URL.isFileURL ? @"Bundled test page loaded." : @"Remote page loaded; verify sign-in and integrations on screen." visible:NO];
    [self captureLoadingDiagnostics];
    [webView evaluateJavaScript:@"!!window.App && !!document.getElementById('stage')" completionHandler:^(id result, NSError *error) {
        if (!error && [result respondsToSelector:@selector(boolValue)] && [result boolValue]) {
            // Lock only the document's native scroll view; CSS overflow panels stay interactive.
            webView.scrollView.scrollEnabled = NO;
            [webView.scrollView setContentOffset:CGPointZero animated:NO];
        }
    }];
}
- (void)showError:(NSError *)error {
    if ([error.domain isEqualToString:NSURLErrorDomain] && error.code == NSURLErrorCancelled) return;
    [self retryFailure:[NSString stringWithFormat:@"Navigation failed (%ld). Check Wi-Fi and the configured site.", (long)error.code]];
}
- (void)webView:(WKWebView *)webView didFailNavigation:(WKNavigation *)navigation withError:(NSError *)error { [self showError:error]; }
- (void)webView:(WKWebView *)webView didFailProvisionalNavigation:(WKNavigation *)navigation withError:(NSError *)error { [self showError:error]; }
- (void)webViewWebContentProcessDidTerminate:(WKWebView *)webView { [self retryFailure:@"Web content process ended."]; }
- (void)webView:(WKWebView *)webView decidePolicyForNavigationResponse:(WKNavigationResponse *)response decisionHandler:(void (^)(WKNavigationResponsePolicy))handler {
    if (response.isForMainFrame && [response.response isKindOfClass:NSHTTPURLResponse.class] && ((NSHTTPURLResponse *)response.response).statusCode >= 400) {
        NSInteger code = ((NSHTTPURLResponse *)response.response).statusCode;
        handler(WKNavigationResponsePolicyCancel);
        if (code >= 500) [self retryFailure:[NSString stringWithFormat:@"Server returned HTTP %ld.", (long)code]];
        else [self setStatus:[NSString stringWithFormat:@"Site returned HTTP %ld. Use Maintenance to reload or check the URL.", (long)code] visible:YES];
        return;
    }
    handler(WKNavigationResponsePolicyAllow);
}
- (void)webView:(WKWebView *)webView decidePolicyForNavigationAction:(WKNavigationAction *)action decisionHandler:(void (^)(WKNavigationActionPolicy))handler {
    NSURL *url = action.request.URL;
    BOOL main = !action.targetFrame || action.targetFrame.mainFrame;
    NSURL *testURL = [NSBundle.mainBundle URLForResource:@"test" withExtension:@"html"];
    if ((self.testing && [url isEqual:testURL]) || [url.absoluteString isEqualToString:@"about:blank"]) { handler(WKNavigationActionPolicyAllow); return; }
    BOOL https = [url.scheme.lowercaseString isEqualToString:@"https"];
    NSString *origin = [self origin:url];
    NSString *configured = [self origin:[self validatedURL:[self configuredURL]]];
    BOOL configuredOrigin = origin.length && [origin isEqualToString:configured];
    // Keep system TLS validation. Never implement certificate-challenge overrides.
    if (!self.isolationAvailable || (!https && !configuredOrigin)) { handler(WKNavigationActionPolicyCancel); return; }
    if (!main) { handler(WKNavigationActionPolicyAllow); return; }
    if (configuredOrigin || [self.approvedOrigins containsObject:origin]) {
        if (!action.targetFrame) { handler(WKNavigationActionPolicyCancel); [webView loadRequest:action.request]; }
        else handler(WKNavigationActionPolicyAllow);
        return;
    }
    // New HTTPS origins (including identity providers) require deliberate approval.
    // Keep the request only in memory and show the origin, never its query tokens.
    handler(WKNavigationActionPolicyCancel);
    if (self.presentedViewController) return;
    [self cancelRetry];
    UIAlertController *alert = [UIAlertController alertControllerWithTitle:@"Open this site?" message:[NSString stringWithFormat:@"%@\nAllow only if this is an expected dashboard or sign-in site. It will open in this view.", origin] preferredStyle:UIAlertControllerStyleAlert];
    [alert addAction:[UIAlertAction actionWithTitle:@"Cancel" style:UIAlertActionStyleCancel handler:^(UIAlertAction *item) { (void)item; [self setStatus:@"Navigation cancelled. Use Maintenance to reload." visible:YES]; }]];
    [alert addAction:[UIAlertAction actionWithTitle:@"Open" style:UIAlertActionStyleDefault handler:^(UIAlertAction *item) {
        (void)item;
        [self.approvedOrigins addObject:origin];
        [self.webView loadRequest:action.request];
    }]];
    [self presentViewController:alert animated:YES completion:nil];
}
@end
