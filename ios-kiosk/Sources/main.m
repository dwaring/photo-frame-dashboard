#import <UIKit/UIKit.h>
#import "KioskController.h"
@interface AppDelegate : UIResponder <UIApplicationDelegate>
@property(nonatomic, strong) UIWindow *window;
@property(nonatomic) BOOL previousIdleState;
@end
@implementation AppDelegate
- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)options {
    self.window = [[UIWindow alloc] initWithFrame:UIScreen.mainScreen.bounds];
    self.window.rootViewController = [KioskController new];
    [self.window makeKeyAndVisible];
    return YES;
}
- (void)applicationDidBecomeActive:(UIApplication *)application {
    self.previousIdleState = application.idleTimerDisabled;
    application.idleTimerDisabled = YES;
}
- (void)applicationWillResignActive:(UIApplication *)application { application.idleTimerDisabled = self.previousIdleState; }
@end
int main(int argc, char *argv[]) {
    @autoreleasepool { return UIApplicationMain(argc, argv, nil, NSStringFromClass(AppDelegate.class)); }
}
