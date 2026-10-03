import { Head, Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { login } from '@/routes';

export default function Register() {
    return (
        <div className="text-center space-y-4">
            <Head title="Registration Closed" />
            <h2 className="text-xl font-bold">Registration by Invitation Only</h2>
            <p className="text-sm text-muted-foreground">
                Public registration is disabled. Please contact the administrator to receive access.
            </p>
            <div className="pt-2">
                <Button asChild className="w-full">
                    <Link href={login()}>Return to Log in</Link>
                </Button>
            </div>
        </div>
    );
}
